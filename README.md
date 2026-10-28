# Voipify — Internet Calling & Phone Dialer App

A mobile-first internet calling application built with Next.js 15, TypeScript, Tailwind CSS, and WebRTC, designed to deploy autonomously on free-tier cloud infrastructure without requiring the owner's laptop to stay powered on.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

### 3. Run Automated Tests
```bash
npm test
```
All **33 unit, integration, and robustness tests** run and pass across 3 suites:
- **Calling App Suite (12 tests)**: JWT authentication, presence sync, SDP offer/answer relay, ICE candidate exchange, busy state, call rejection, call cancellation, and DB logging.
- **Telephony Suite (14 tests)**: International E.164 phone number validation, DoT/TRAI eligibility gating, mock provider state boundaries, rate limiting, and favorites management.
- **Robustness Suite (7 tests)**: Environment fallbacks, database self-healing, corrupt file recovery, non-deceptive call states, and input boundary conditions.

### 4. Start Server Locally
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📱 Feature Capabilities & Architecture

| Feature | Status | Operational Details |
| :--- | :--- | :--- |
| **App-to-App Internet Calling** | **Live & Functional** | Real encrypted WebRTC peer-to-peer audio calls between registered users with active presence, ringback, mute, visualizer, and diagnostics. |
| **Phone Dialer Interface** | **Live & Functional** | Tactile 12-key numeric dialpad with authentic ITU-T DTMF audio feedback, country code picker, E.164 parsing, favorites, and recents. |
| **Outbound PSTN Mobile Calls** | **Safely Disabled (₹0 Budget)** | Calling arbitrary telephone numbers without our app requires paid PSTN termination (~₹1.80–₹3.50/min) and Indian DoT/TRAI compliance. **The app never simulates a connected call.** |
| **Cloud Deployment** | **Ready for Deploy** | Configured for Render Free Tier (`render.yaml`) and container hosting (`Dockerfile`) so the app runs autonomously without the owner's laptop. |

---

## ☁️ Cloud Deployment (Autonomous Hosting)

### Deploy to Render Free Tier (Zero Laptop Dependency)
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/<your-username>/voipify.git
   git push -u origin master
   ```
2. Log into [render.com](https://render.com) and click **New +** ➔ **Blueprint**.
3. Select your repository. Render automatically reads [render.yaml](render.yaml) and configures:
   - Node.js runtime with WebSockets
   - Build: `npm install && npm run build`
   - Start: `node server.js`
   - Health check probe: `/api/health`
4. Deploy the service. Once built, Render issues a permanent public HTTPS URL (`https://voipify-xxxx.onrender.com`).

---

## 🔒 Environment Variables Reference

| Variable | Required? | Default / Purpose |
| :--- | :--- | :--- |
| `PORT` | Optional | `3000` (Local) / `10000` (Render default) |
| `NODE_ENV` | Optional | `production` in deployment |
| `JWT_SECRET` | **Required** | Random 32+ character string for session tokens |
| `ENABLE_REAL_PSTN_CALLS` | Optional | `false` (Maintains ₹0 budget and prevents unexpected carrier charges) |
| `NEXT_PUBLIC_STUN_SERVERS` | Optional | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` |
| `DATABASE_URL` | Optional | Remote PostgreSQL connection string for hosted persistence |
| `TWILIO_ACCOUNT_SID` | Optional | Telephony provider SID (if upgrading to paid PSTN route) |
| `TWILIO_AUTH_TOKEN` | Optional | Telephony provider token |
| `TWILIO_PHONE_NUMBER` | Optional | E.164 outbound Caller ID number |

---

## 🛡️ Rollback and Recovery Instructions

If you need to roll back changes or restore a clean state:
```bash
# View recent commits
git log --oneline -n 5

# Reset to the previous commit while keeping file changes unstaged
git reset HEAD~1

# Or completely restore to a known commit
git reset --hard <commit-hash>
```

---

## 📚 Technical Documentation Links

- [Architecture & Protocol Specification](docs/ARCHITECTURE.md)
- [Telephony Provider & ₹0 Budget Analysis](docs/TELEPHONY_AND_BUDGET_ANALYSIS.md)
- [Autonomous Cloud Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Security, Privacy & TURN Relay Deployment](docs/SECURITY_AND_TURN.md)
- [DoT India Telecom Regulatory Analysis](docs/TELECOM_AND_FUTURE_ROADMAP.md)
- [Hosted Database Schema](scripts/schema.sql)
