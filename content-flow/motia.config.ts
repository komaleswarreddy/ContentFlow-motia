import { defineConfig } from '@motiadev/core'
import endpointPlugin from '@motiadev/plugin-endpoint/plugin'
import logsPlugin from '@motiadev/plugin-logs/plugin'
import observabilityPlugin from '@motiadev/plugin-observability/plugin'
import statesPlugin from '@motiadev/plugin-states/plugin'
import bullmqPlugin from '@motiadev/plugin-bullmq/plugin'

export default defineConfig({
  plugins: [observabilityPlugin, statesPlugin, endpointPlugin, logsPlugin, bullmqPlugin],
  app: (app) => {
    // Health check endpoint for Render and other deployment platforms
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'contentflow-backend'
      })
    })
  },
})
