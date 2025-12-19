# 🚀 Complete Deployment Guide for Render

This guide will walk you through deploying both the backend (Motia) and frontend (Next.js) to Render step-by-step.

## 📋 Prerequisites

1. **Render Account**: Sign up at https://render.com (free tier available)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Clerk Production Keys**: Get production keys from Clerk Dashboard
4. **Mistral AI API Key**: Get your API key from Mistral AI

---

## 🔑 Step 1: Get Production API Keys

### Clerk Production Keys

1. Go to https://dashboard.clerk.com
2. Select your application (or create a new one for production)
3. Go to **API Keys** section
4. Copy the **Production** keys (they start with `pk_live_` and `sk_live_`)
5. **Important**: You'll need these for Step 4

### Mistral AI API Key

1. Go to https://console.mistral.ai/
2. Navigate to **API Keys** section
3. Create a new API key or copy existing one
4. Save this key securely

---

## 📦 Step 2: Prepare Your Repository

### Verify Files Are Ready

Make sure these files exist in your repository:
- ✅ `render.yaml` (in root directory)
- ✅ `content-flow/package.json` (backend)
- ✅ `frontend/package.json` (frontend)
- ✅ `content-flow/motia.config.ts` (backend config)
- ✅ `frontend/next.config.ts` (frontend config)

### Commit and Push to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

---

## 🌐 Step 3: Connect Repository to Render

1. Log in to https://dashboard.render.com
2. Click **New +** → **Blueprint**
3. Connect your GitHub account if not already connected
4. Select your repository
5. Render will detect the `render.yaml` file automatically
6. Click **Apply**

---

## ⚙️ Step 4: Configure Environment Variables

After Render creates the services, you need to add environment variables:

### Backend Service (contentflow-backend)

1. Go to your **contentflow-backend** service in Render
2. Navigate to **Environment** tab
3. Add these variables:

```
MISTRAL_API_KEY=your_mistral_api_key_here
NODE_ENV=production
PORT=10000
```

### Frontend Service (contentflow-frontend)

1. Go to your **contentflow-frontend** service in Render
2. Navigate to **Environment** tab
3. Add these variables:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key_here
CLERK_SECRET_KEY=sk_live_your_production_secret_key_here
NODE_ENV=production
```

**Note**: `MOTIA_BACKEND_URL` and `NEXT_PUBLIC_MOTIA_BACKEND_URL` are automatically set by Render from the backend service.

---

## 🏗️ Step 5: Deploy Services

### Automatic Deployment

Once you've added environment variables:

1. Go to each service (backend first, then frontend)
2. Click **Manual Deploy** → **Deploy latest commit**
3. Wait for deployment to complete (5-10 minutes)

### Deployment Order

1. **Deploy Backend First**: Wait for backend to be healthy
2. **Then Deploy Frontend**: Frontend depends on backend URL

---

## ✅ Step 6: Verify Deployment

### Check Backend Health

1. Get your backend URL from Render (e.g., `https://contentflow-backend.onrender.com`)
2. Visit: `https://your-backend-url.onrender.com/health`
3. Should return: `{"status":"healthy",...}`

### Check Frontend

1. Get your frontend URL from Render (e.g., `https://contentflow-frontend.onrender.com`)
2. Visit the URL in your browser
3. Should load your application

---

## 🔧 Step 7: Configure Clerk Production Instance

1. Go to https://dashboard.clerk.com
2. Click **Create production instance** (or use existing)
3. Enter your frontend domain: `https://your-frontend-url.onrender.com`
4. Save the configuration

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend fails to start
- Check `MISTRAL_API_KEY` is set correctly
- Verify build logs in Render dashboard
- Check that `content-flow` directory structure is correct

**Problem**: Health check fails
- Verify `/health` endpoint is accessible
- Check service logs in Render dashboard

### Frontend Issues

**Problem**: Frontend can't connect to backend
- Verify `MOTIA_BACKEND_URL` is set (should be auto-set by Render)
- Check backend service is running and healthy
- Verify CORS settings if needed

**Problem**: Clerk authentication errors
- Verify production keys are used (not test keys)
- Check keys are from the same Clerk application
- Ensure Clerk production instance is configured with correct domain

### Build Issues

**Problem**: Build fails
- Check Node.js version (Render uses Node 18+ by default)
- Verify all dependencies are in `package.json`
- Check build logs for specific errors

---

## 📊 Monitoring

### View Logs

1. Go to your service in Render dashboard
2. Click **Logs** tab
3. View real-time logs

### Health Checks

- Backend: `https://your-backend-url.onrender.com/health`
- Frontend: `https://your-frontend-url.onrender.com/api/health`

---

## 🔄 Updating Deployment

### Automatic Updates

Render automatically deploys when you push to your main branch (if auto-deploy is enabled).

### Manual Updates

1. Go to service in Render
2. Click **Manual Deploy** → **Deploy latest commit**

---

## 💰 Cost Considerations

### Free Tier Limits

- **Services**: 2 free web services
- **Sleep**: Services sleep after 15 minutes of inactivity
- **Build Time**: 500 build minutes/month

### Paid Plans

- **Starter**: $7/month per service (no sleep, more resources)
- **Professional**: $25/month per service (better performance)

---

## 📝 Environment Variables Summary

### Backend (contentflow-backend)
```
MISTRAL_API_KEY=required
NODE_ENV=production
PORT=10000
```

### Frontend (contentflow-frontend)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=required (production key)
CLERK_SECRET_KEY=required (production key)
MOTIA_BACKEND_URL=auto-set by Render
NEXT_PUBLIC_MOTIA_BACKEND_URL=auto-set by Render
NODE_ENV=production
```

---

## ✅ Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Clerk production keys obtained
- [ ] Mistral AI API key obtained
- [ ] Render account created
- [ ] Repository connected to Render
- [ ] Services created from render.yaml
- [ ] Environment variables added to backend
- [ ] Environment variables added to frontend
- [ ] Backend deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Clerk production instance configured
- [ ] Health checks passing
- [ ] Application tested end-to-end

---

## 🆘 Need Help?

- **Render Docs**: https://render.com/docs
- **Clerk Docs**: https://clerk.com/docs
- **Motia Docs**: https://motia.dev/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Last Updated**: Based on current project structure
**Render Blueprint**: Uses `render.yaml` for infrastructure as code

