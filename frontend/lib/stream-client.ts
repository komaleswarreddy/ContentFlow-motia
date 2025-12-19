/**
 * Motia Stream Client
 * 
 * Connects to Motia backend streams via WebSocket for real-time updates.
 * Supports both comments and content updates streams.
 */

import { useState, useEffect, useCallback } from 'react';

const MOTIA_BACKEND_URL = process.env.NEXT_PUBLIC_MOTIA_BACKEND_URL || 'http://localhost:3000';
const WS_URL = MOTIA_BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');

export interface StreamMessage {
  type: string;
  data: any;
}

export type StreamCallback = (message: StreamMessage) => void;

export class MotiaStreamClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private callbacks: Map<string, Set<StreamCallback>> = new Map();
  private isConnecting = false;
  private subscriptions: Set<string> = new Set();

  constructor(
    private streamName: string,
    private groupId: string,
    private onConnect?: () => void,
    private onDisconnect?: () => void,
    private onError?: (error: Error) => void
  ) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const url = `${WS_URL}/streams/${this.streamName}?groupId=${encodeURIComponent(this.groupId)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[StreamClient] Connected to ${this.streamName} stream`);
        }
        this.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[StreamClient] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        // Silently handle WebSocket errors - streams may not be available
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
          console.debug('[StreamClient] WebSocket connection not available - falling back to polling');
        }
        // Don't call onError to avoid spamming console
        // Streams are optional, polling will be used as fallback
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[StreamClient] Disconnected from ${this.streamName} stream`);
        }
        this.onDisconnect?.();
        // Only attempt reconnect if we had a successful connection before
        // If connection fails immediately, don't keep retrying
        if (this.reconnectAttempts === 0) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      this.isConnecting = false;
      // Silently handle - WebSocket may not be supported
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamClient] WebSocket not available - using polling fallback');
      }
      // Don't call onError - streams are optional
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Silently stop reconnecting - streams are optional
      if (process.env.NODE_ENV === 'development') {
        console.debug('[StreamClient] WebSocket streams not available - using polling fallback');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // Only log in development
    if (process.env.NODE_ENV === 'development' && this.reconnectAttempts <= 2) {
      console.debug(`[StreamClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(message: StreamMessage): void {
    // Call all callbacks for this message type
    const callbacks = this.callbacks.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('[StreamClient] Callback error:', error);
        }
      });
    }

    // Also call wildcard callbacks
    const wildcardCallbacks = this.callbacks.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('[StreamClient] Callback error:', error);
        }
      });
    }
  }

  subscribe(eventType: string, callback: StreamCallback): () => void {
    if (!this.callbacks.has(eventType)) {
      this.callbacks.set(eventType, new Set());
    }
    this.callbacks.get(eventType)!.add(callback);

    // Auto-connect if not connected
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(eventType);
        }
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.clear();
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * React hook for using Motia streams
 */
export function useMotiaStream(
  streamName: string,
  groupId: string,
  enabled: boolean = true
) {
  const [client, setClient] = useState<MotiaStreamClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !groupId) {
      return;
    }

    // Disable streams for now - WebSocket endpoint may not be available
    // Fall back to polling instead
    const STREAMS_ENABLED = false; // Set to true when Motia WebSocket streams are configured

    if (!STREAMS_ENABLED) {
      return;
    }

    const streamClient = new MotiaStreamClient(
      streamName,
      groupId,
      () => setIsConnected(true),
      () => setIsConnected(false),
      // Silently handle errors - streams are optional
      () => {}
    );

    setClient(streamClient);
    streamClient.connect();

    return () => {
      streamClient.disconnect();
      setClient(null);
      setIsConnected(false);
    };
  }, [streamName, groupId, enabled]);

  const subscribe = useCallback((eventType: string, callback: StreamCallback) => {
    if (!client) return () => {};
    return client.subscribe(eventType, callback);
  }, [client]);

  return {
    client,
    isConnected,
    subscribe,
  };
}

