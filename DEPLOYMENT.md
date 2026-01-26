# Deployment Guide for Vapor Chat

## Why Vercel Doesn't Work

Vapor Chat uses:
- **Custom Node.js server** (`server.js`) with Socket.io
- **WebSocket connections** for real-time chat
- **In-memory state** (rooms, sessions, messages)

**Vercel limitations:**
- ❌ No custom servers (only serverless functions)
- ❌ No WebSocket support
- ❌ No persistent connections

## ✅ Recommended Platforms (Support WebSockets)

### Option 1: Railway (Easiest)

1. **Sign up**: https://railway.app
2. **Install Railway CLI** (optional):
   ```bash
   npm i -g @railway/cli
   railway login
   ```
3. **Deploy**:
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo" (or use CLI: `railway init`)
   - Select your repository
   - Railway auto-detects Node.js
4. **Configure**:
   - Railway will run `npm run build` then `npm run start`
   - Set environment variable: `NODE_ENV=production`
   - Railway assigns a port automatically (use `process.env.PORT`)
5. **Update server.js** to use Railway's port:
   ```js
   const port = parseInt(process.env.PORT || "3000", 10);
   const hostname = process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "localhost";
   ```

### Option 2: Render

1. **Sign up**: https://render.com
2. **Create Web Service**:
   - Connect GitHub repo
   - Build Command: `npm run build`
   - Start Command: `npm run start`
   - Environment: `Node`
3. **Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=10000` (Render uses port 10000 by default)
4. **Update server.js**:
   ```js
   const port = parseInt(process.env.PORT || "10000", 10);
   const hostname = "0.0.0.0";
   ```

### Option 3: Fly.io

1. **Install Fly CLI**: https://fly.io/docs/getting-started/installing-flyctl/
2. **Initialize**:
   ```bash
   fly launch
   ```
3. **Create `fly.toml`**:
   ```toml
   app = "vapor-chat"
   primary_region = "iad"

   [build]
     builder = "paketobuildpacks/builder:base"

   [[services]]
     internal_port = 3000
     protocol = "tcp"
     [[services.ports]]
       port = 80
       handlers = ["http"]
     [[services.ports]]
       port = 443
       handlers = ["tls", "http"]
   ```
4. **Deploy**: `fly deploy`

### Option 4: DigitalOcean App Platform

1. **Sign up**: https://www.digitalocean.com
2. **Create App** → Connect GitHub
3. **Configure**:
   - Build Command: `npm run build`
   - Run Command: `npm run start`
   - HTTP Port: `3000`
4. **Environment**: `NODE_ENV=production`

## 🔧 Required Server.js Updates

Update `server.js` to work with cloud platforms:

```javascript
const hostname = process.env.HOSTNAME || "0.0.0.0"; // Listen on all interfaces
const port = parseInt(process.env.PORT || "3000", 10);
```

## 📝 Quick Fix for Current Setup

Update your `server.js` line 8-9:

```javascript
// Change from:
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// To:
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
```

This allows the server to listen on all network interfaces (required for cloud hosting).

## 🚀 Recommended: Railway

**Why Railway?**
- ✅ Free tier (500 hours/month)
- ✅ Auto-deploys from GitHub
- ✅ WebSocket support
- ✅ Simple setup
- ✅ Automatic HTTPS

**Steps:**
1. Push code to GitHub
2. Go to https://railway.app/new
3. Select "Deploy from GitHub repo"
4. Select your repo
5. Railway handles the rest!

Your app will be live at: `https://your-app-name.up.railway.app`
