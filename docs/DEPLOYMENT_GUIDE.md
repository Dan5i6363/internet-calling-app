# Cloud Deployment Guide — ₹0 Autonomous Hosting (No Laptop Needed)

This guide documents how to deploy Voipify so it runs continuously in the cloud without requiring the owner's laptop to stay powered on.

---

## 1. Option A: Vercel Free Tier (Recommended for Web & REST APIs)

Vercel provides free global edge hosting for Next.js applications with zero server maintenance.

### Deployment Steps:
1. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/your-username/voipify.git
   git push -u origin master
   ```

2. **Import into Vercel**:
   - Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
   - Select your GitHub repository.
   - Framework preset: **Next.js**.

3. **Configure Environment Variables in Vercel Dashboard**:
   | Variable | Value / Description | Required? |
   | :--- | :--- | :--- |
   | `JWT_SECRET` | Strong random 32+ character string | Yes |
   | `ENABLE_REAL_PSTN_CALLS` | `false` (Keeps ₹0 budget safe) | Yes |
   | `NEXT_PUBLIC_STUN_SERVERS` | `stun:stun.l.google.com:19302` | Yes |
   | `TWILIO_ACCOUNT_SID` | *(Leave empty for ₹0 mode)* | Optional |
   | `TWILIO_AUTH_TOKEN` | *(Leave empty for ₹0 mode)* | Optional |
   | `TWILIO_PHONE_NUMBER` | *(Leave empty for ₹0 mode)* | Optional |

4. **Click Deploy**:
   Vercel compiles the build and assigns a global HTTPS URL (e.g., `https://voipify.vercel.app`).

### Free-Tier Limitations on Vercel:
- **Serverless Execution**: API routes run on serverless functions with a 10s timeout limit (sufficient for dialing and status checks).
- **WebSockets**: Native Vercel serverless functions do not host persistent stateful WebSocket servers. For persistent WebSockets, use Option B (Render) or a managed signaling service.

---

## 2. Option B: Render.com Free Web Service (Supports WebSockets)

Render offers free web service instances that support persistent WebSocket connections.

### Deployment Steps:
1. Create a free account at [render.com](https://render.com).
2. Click **New +** ➔ **Web Service** ➔ Connect GitHub repo.
3. Configure settings:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free ($0/month)
4. Add environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=production_random_secret_string_here_32_chars
   ENABLE_REAL_PSTN_CALLS=false
   ```
5. Click **Create Web Service**.

### Free-Tier Limitations on Render:
- **Instance Spin-down**: Free web services sleep after 15 minutes of inactivity. The first subsequent request takes 30–50 seconds to spin back up (cold start).
- **RAM / CPU**: 512 MB RAM and 0.1 CPU core (ample for Voipify's lightweight architecture).
- **Monthly Usage**: 750 free hours/month (enough to run one continuous service all month).

---

## 3. Financial & Operational Cost Summary

| Component | Provider | Cost at Launch | Running Cost |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | Vercel / Render Free Tier | ₹0 | ₹0/month |
| **Signaling & APIs** | Serverless / Free Container | ₹0 | ₹0/month |
| **STUN NAT Traversal** | Google & Cloudflare STUN | ₹0 | ₹0/month |
| **Simulated Calling Engine** | Self-Contained Next.js | ₹0 | ₹0/month |
| **Real PSTN Calling (If Upgraded)** | Twilio / Plivo / Exotel | Requires funding | ~₹1.80 to ₹3.50 per minute |
