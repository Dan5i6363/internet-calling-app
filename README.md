# Voipify — Internet Calling App (Web + Mobile PWA)

A responsive, mobile-first internet calling application for free, high-fidelity app-to-app audio calling over Wi-Fi or mobile data without cellular calling balance or telephone number requirements.

---

## ⚡ Quick Start (Under 1 Minute)

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
All 9 unit & integration tests run in ~2 seconds:
- Password hashing & JWT issuance
- Duplicate username prevention
- Contact search & self-filtering
- Real-time presence exchange
- Rejection of self-calls & offline users
- Complete WebRTC call flow (Ringing ➔ Accept ➔ SDP Relay ➔ ICE Relay ➔ Busy detection ➔ Hang up ➔ DB persistence)

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📱 Two-Client Testing Procedure

1. **Window 1 (Alice)**:
   - Open [http://localhost:3000](http://localhost:3000) in Chrome / Edge.
   - Click "Sign Up" and register with username `alice` (Password: `password123`).
   - Observe the presence indicator turn **Green (Available)**.

2. **Window 2 (Bob)**:
   - Open [http://localhost:3000](http://localhost:3000) in an **Incognito / Private Window** (or a second device on the same Wi-Fi).
   - Click "Sign Up" and register with username `bob` (Password: `password123`).

3. **Placing a Call**:
   - In Alice's window, find `bob` in the Contacts tab (showing online status).
   - Click the green **Phone** button next to Bob.
   - Alice hears synthetic **Ringback tone** (440+480 Hz cadence).
   - Bob's screen displays a full-screen **Incoming Call Modal** with pulsing ring animation and musical chime ringtone.

4. **Accepting & In-Call Audio**:
   - Bob clicks **Accept**.
   - Ringing stops instantly. WebRTC peer connection initializes and acquires microphone permission.
   - Both screens transition to the **Active Call Screen**:
     - Real-time timer starts (`00:01`, `00:02`...).
     - Green audio visualizer waveform animates in response to microphone sound.
     - Click **Mute** to mute local audio track.
     - Click **Diagnostics** to view live **Round-Trip Time (RTT)**, **Jitter**, **Bitrate**, and **ICE Candidate Type**.

5. **Ending Call & History**:
   - Either party clicks the red **End Call** button.
   - Call beep plays.
   - Navigate to the **Recents** tab to view the logged call with duration and timestamp.

---

## 📲 Installing as a Mobile PWA

- **Android (Chrome)**: Tap the "Install" badge in the top bar or Chrome menu ➔ "Add to Home screen".
- **iOS (Safari)**: Tap the Share button ➔ "Add to Home Screen".
- Launching from the home screen runs Voipify in standalone full-screen mode with native mobile ergonomics.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons.
- **Audio & Media**: Native WebRTC (`RTCPeerConnection`), OPUS codec (48kHz, PLC, FEC), Web Audio API for audio visualization and synthetic ringtones.
- **Signaling**: Authenticated WebSocket (`ws`) server with JWT handshake and heartbeat monitoring.
- **Persistence**: Atomic file-backed JSON database store with zero external container dependencies.
- **NAT Traversal**: STUN (Google / Cloudflare defaults) + configurable TURN relay via `.env`.

---

## 📚 Documentation Links

- [Architecture & Protocol Specification](docs/ARCHITECTURE.md)
- [Security, Privacy & TURN Relay Deployment](docs/SECURITY_AND_TURN.md)
- [DoT India Telecom Regulatory Analysis & Technical Roadmap](docs/TELECOM_AND_FUTURE_ROADMAP.md)
