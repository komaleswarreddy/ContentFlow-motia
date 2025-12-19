 # 🏆 ContentFlow — AI-Powered Content Decision Pipeline

> 

ContentFlow is a **production-grade, event-driven content workflow system** that demonstrates how **Motia's unified backend primitives** can replace a traditional multi-service architecture.

It is not just an AI content analyzer —  
it is a **reliable decision pipeline** designed for correctness, scalability, observability, and failure recovery.

---

## 🔍 Why This Project Matters

Content teams process large volumes of submissions every day.  
Manual review is slow, inconsistent, and does not scale.

ContentFlow automates this workflow by:
- validating content
- analyzing quality with AI
- generating actionable recommendations
- tracking progress in real time
- recovering gracefully from failures

All of this is implemented using **one backend primitive: Motia Steps**.

---

## 🚀 Why Motia? (The Competitive Advantage)

### The Traditional Approach

A typical implementation requires:

- Express / Fastify (API layer)
- Redis / SQS (message queue)
- Background workers
- Database coordination
- Retry logic (manual)
- Observability tools
- Deployment orchestration

**Result**:
- 1,000+ lines of glue code  
- Multiple failure points  
- Complex debugging across services  

---

### ContentFlow with Motia

Motia replaces the entire stack with **one unified runtime**:

| Capability | Motia Implementation |
|----------|----------------------|
| API Endpoints | `Step.api()` |
| Background Jobs | `Step.event()` |
| Scheduled Tasks | `Step.cron()` |
| Real-time Updates | `Step.stream()` |
| State Management | Built-in & persistent |
| Retries & Ordering | Automatic |
| Observability | Built-in dashboard |

**Outcome**:
- ~79% less code
- Deterministic workflows
- No race conditions
- One place to debug everything

> ContentFlow could not be built this cleanly without Motia.

---

## ✨ Key Features

### 📝 Content Submission
- Submit title, body, and metadata
- Immediate acknowledgement
- Non-blocking workflow start

### ✅ Automated Validation
- Minimum length checks
- Language support validation
- Early rejection with clear feedback

### 🤖 AI-Powered Analysis (Mistral AI)
- Sentiment analysis
- Topic extraction
- Quality and readability scoring
- AI-generated summary
- Timeout handling with fallback

### 🎯 Smart Recommendations
- Publish readiness classification
- Improvement suggestions
- Priority-based actions

### 🔄 Event-Driven Workflow



### 📡 Real-Time Status Updates
- Live progress updates
- Stream + polling fallback
- Zero data loss on disconnect

### 🧯 Failure-First Design
- Automatic retries with backoff
- Graceful AI degradation
- State-first persistence
- No stuck workflows

---

## 🧠 Architecture Overview

ContentFlow follows a **state-first, event-driven architecture**.

Each step:
- receives an event
- performs one responsibility
- persists state
- emits the next event

This guarantees:
- correct ordering
- atomic updates
- easy observability

 

---

## 🛠 Tech Stack

### Backend
- **Motia** — Unified backend framework
- Event-driven steps
- Built-in state management
- Built-in observability

### Frontend
- **Next.js 14** (App Router)
- Tailwind CSS
- Framer Motion

### AI
- **Mistral AI API**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|------|----------|-------------|
| POST | `/content` | Submit new content |
| GET | `/content/:id` | Get workflow status & results |
| GET | `/content` | List all content |
| DELETE | `/content/:id` | Delete content |
| POST | `/content/:id/comments` | Add comment |
| POST | `/content/:id/improve` | Request AI improvement |

📄 Full API examples: `postman-collection.json`

---

## ⚙️ Complete Setup Guide (End-to-End)

 

---

### 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js v18+** installed ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Mistral AI API Key** ([Get one here](https://console.mistral.ai/))
- **Clerk Account** (for authentication) - [Sign up](https://clerk.com/) (optional but recommended)

---

### 🚀 Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd Motia

# Install root dependencies (if any)
npm install

# Install backend dependencies
cd content-flow
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### 🔐 Step 2: Environment Variables Setup

**🔒 CRITICAL SECURITY NOTE**: Never commit `.env` files or API keys. They are automatically ignored by `.gitignore`.

#### Backend Environment Variables (`content-flow/.env`)

Create a `.env` file in the `content-flow/` directory:

```bash
cd content-flow
touch .env
```

Add the following variables:

```env
# ============================================
# Mistral AI Configuration (REQUIRED)
# ============================================
# Get your API key from: https://console.mistral.ai/
MISTRAL_API_KEY=your_mistral_api_key_here

# ============================================
# Motia Backend Configuration (Optional)
# ============================================
# Default: http://localhost:3000
MOTIA_BACKEND_URL=http://localhost:3000

# ============================================
# Redis Configuration (if using external Redis)
# ============================================
# REDIS_URL=redis://localhost:6379
```

**How to get Mistral API Key:**
1. Visit [Mistral AI Console](https://console.mistral.ai/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Copy the key and paste it in your `.env` file

#### Frontend Environment Variables (`frontend/.env.local`)

Create a `.env.local` file in the `frontend/` directory:

```bash
cd ../frontend
touch .env.local
```

Add the following variables:

```env
# ============================================
# Clerk Authentication (REQUIRED)
# ============================================
# Get your keys from: https://dashboard.clerk.com/
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# ============================================
# Backend API Configuration (REQUIRED)
# ============================================
# This should match your Motia backend URL
NEXT_PUBLIC_MOTIA_BACKEND_URL=http://localhost:3000
MOTIA_BACKEND_URL=http://localhost:3000

# ============================================
# Next.js Configuration (Optional)
# ============================================
NODE_ENV=development
```

**How to get Clerk Keys:**
1. Visit [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application or select existing one
3. Go to **API Keys** section
4. Copy **Publishable Key** (starts with `pk_test_` or `pk_live_`)
5. Copy **Secret Key** (starts with `sk_test_` or `sk_live_`)
6. Paste both in your `.env.local` file

---

### 🏃 Step 3: Start the Backend Server

Open a **new terminal window** and navigate to the backend directory:

```bash
cd content-flow
npm run dev
```

**Expected Output:**
```
✓ Motia server starting...
✓ Listening on http://localhost:3000
✓ Workbench available at http://localhost:3000/workbench
```

**✅ Verification:**
- Backend should be running on `http://localhost:3000`
- You should see API endpoints listed in the console
- Workbench UI should be accessible at `http://localhost:3000/workbench`

**Common Issues:**
- **Port 3000 already in use**: Change `MOTIA_BACKEND_URL` in both `.env` files to use a different port
- **MISTRAL_API_KEY not found**: Ensure `.env` file exists in `content-flow/` directory
- **Module not found**: Run `npm install` again in `content-flow/` directory

---

### 🎨 Step 4: Start the Frontend Server

Open **another new terminal window** and navigate to the frontend directory:

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
✓ Local: http://localhost:3001
```

**✅ Verification:**
- Frontend should be running on `http://localhost:3001`
- Open `http://localhost:3001` in your browser
- You should see the ContentFlow homepage

**Common Issues:**
- **Port 3001 already in use**: The frontend uses port 3001 by default (see `frontend/package.json`)
- **CLERK_PUBLISHABLE_KEY error**: Ensure `.env.local` exists in `frontend/` directory with valid Clerk keys
- **Cannot connect to backend**: Verify backend is running and `MOTIA_BACKEND_URL` matches backend URL

---

### 🧪 Step 5: Verify End-to-End Setup

#### Test Backend API

```bash
# Test backend health (in a new terminal)
curl http://localhost:3000/content

# Expected: Should return empty array [] or list of content
```

#### Test Frontend Connection

1. Open `http://localhost:3001` in your browser
2. You should see the ContentFlow homepage
3. Click **"Get Started"** or navigate to `/submit`
4. Try submitting a test content item

#### Test AI Analysis

1. Submit content with title and body (minimum 50 characters)
2. Wait for AI analysis to complete (usually 5-10 seconds)
3. Check the dashboard to see analysis results

---

### 📊 Project Structure Overview

```
Motia/
├── content-flow/          # Backend (Motia)
│   ├── src/
│   │   ├── api/          # API endpoints
│   │   ├── events/       # Event handlers (AI analysis, etc.)
│   │   └── streams/      # Real-time streams
│   ├── .env              # Backend environment variables
│   └── package.json
│
├── frontend/             # Frontend (Next.js)
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utility functions
│   ├── .env.local        # Frontend environment variables
│   └── package.json
│
└── README.md            # This file
```

---

### 🔧 Troubleshooting

#### Backend Issues

**Problem**: `MISTRAL_API_KEY not configured`
- **Solution**: Ensure `.env` file exists in `content-flow/` directory with `MISTRAL_API_KEY=your_key`

**Problem**: `Cannot connect to Redis`
- **Solution**: Motia uses in-memory Redis by default. For production, configure external Redis in `.env`

**Problem**: `Port 3000 already in use`
- **Solution**: Change port in `motia.config.ts` or set `PORT=3001` in `.env`

#### Frontend Issues

**Problem**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required`
- **Solution**: Ensure `.env.local` exists in `frontend/` directory with valid Clerk keys

**Problem**: `Failed to fetch content`
- **Solution**: Verify backend is running on `http://localhost:3000` and `MOTIA_BACKEND_URL` matches

**Problem**: `Clerk authentication errors`
- **Solution**: Check Clerk dashboard for correct API keys and ensure application is active

#### AI Analysis Issues

**Problem**: AI analysis fails or times out
- **Solution**: 
  1. Verify `MISTRAL_API_KEY` is valid and has credits
  2. Check Mistral AI console for API status
  3. Review backend logs for detailed error messages

---

### 🎯 Quick Start Checklist

Use this checklist to ensure everything is set up correctly:

- [ ] Node.js v18+ installed
- [ ] Repository cloned
- [ ] Backend dependencies installed (`cd content-flow && npm install`)
- [ ] Frontend dependencies installed (`cd frontend && npm install`)
- [ ] Backend `.env` file created with `MISTRAL_API_KEY`
- [ ] Frontend `.env.local` file created with Clerk keys
- [ ] Backend server running on `http://localhost:3000`
- [ ] Frontend server running on `http://localhost:3001`
- [ ] Can access frontend in browser
- [ ] Can submit content successfully
- [ ] AI analysis completes successfully

---

 
```

---

### 📚 Additional Resources

- **Motia Documentation**: [https://motia.dev/docs](https://motia.dev/docs)
- **Mistral AI Docs**: [https://docs.mistral.ai/](https://docs.mistral.ai/)
- **Clerk Documentation**: [https://clerk.com/docs](https://clerk.com/docs)
- **Next.js Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)

---

### 🆘 Need Help?

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review backend logs in the terminal running `npm run dev`
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
5. Ensure both servers are running simultaneously

---

**🎉 You're all set! Start building amazing content workflows with ContentFlow!**

---

## 📝 Quick Reference

### Ports Used

| Service | Port | URL |
|---------|------|-----|
| Backend (Motia) | 3000 | http://localhost:3000 |
| Frontend (Next.js) | 3001 | http://localhost:3001 |
| Motia Workbench | 3000 | http://localhost:3000/workbench |

### Required Environment Variables Summary

#### Backend (`content-flow/.env`)
```env
MISTRAL_API_KEY=required
MOTIA_BACKEND_URL=optional (default: http://localhost:3000)
```

#### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=required
CLERK_SECRET_KEY=required
MOTIA_BACKEND_URL=required (must match backend URL)
```

### Common Commands

```bash
# Start backend
cd content-flow && npm run dev

# Start frontend (in separate terminal)
cd frontend && npm run dev

# Build for production
cd content-flow && npm run build
cd frontend && npm run build
```

---
 

