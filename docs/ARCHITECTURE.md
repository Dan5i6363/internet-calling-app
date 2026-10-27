# Architecture Specification — Internet Calling App (Voipify)

## 1. Overview
Voipify is an internet calling application providing direct peer-to-peer audio calls over WebRTC with WebSocket-based signaling, real-time presence, and an installable Progressive Web App (PWA) client.

```mermaid
flowchart TB
    subgraph ClientA ["Client A (Caller - Web / PWA)"]
        UA["User Interface & State"]
        WCA["WebRTC Audio Engine"]
        WSA["WebSocket Client"]
    end

    subgraph ServerNode ["Signaling & Backend Node.js Server"]
        HTTP["Next.js App & API Routes"]
        WS["Signaling & Presence Hub"]
        Auth["JWT Token Authenticator"]
        Store[(Atomic File Store / SQLite)]
    end

    subgraph ClientB ["Client B (Callee - Web / PWA)"]
        UB["User Interface & State"]
        WCB["WebRTC Audio Engine"]
        WSB["WebSocket Client"]
    end

    subgraph NATServices ["NAT Traversal Services"]
        STUN["STUN Relays (Google / Cloudflare)"]
        TURN["TURN Server (RFC 5766 coturn)"]
    end

    UA <--> HTTP
    UB <--> HTTP
    WSA <== "ws://localhost:3000/ws" ==> WS
    WSB <== "ws://localhost:3000/ws" ==> WS
    WS --> Auth --> Store
    WCA <---> STUN
    WCB <---> STUN
    WCA <---> TURN
    WCB <---> TURN
    WCA <=== "DTLS-SRTP OPUS Audio Stream" ===> WCB
```

---

## 2. Signaling Protocol Specification

The signaling server communicates via JSON over WebSockets (`/ws`). All connections require authentication via JWT token either in the query string (`/ws?token=...`) or via an immediate `auth` message.

### Core Message Types

| Message Type | Direction | Payload Structure | Description |
| :--- | :--- | :--- | :--- |
| `auth` | Client ➔ Server | `{ "type": "auth", "token": string }` | In-band session authorization. |
| `auth_success` | Server ➔ Client | `{ "type": "auth_success", "user": object }` | Confirms session. |
| `presence` | Server ➔ Client | `{ "type": "presence", "username": string, "status": "online"\|"offline" }` | Real-time user presence updates. |
| `call_initiate` | Client ➔ Server | `{ "type": "call_initiate", "targetUsername": string }` | Request to call a peer. |
| `call_ringing` | Server ➔ Caller | `{ "type": "call_ringing", "callId": string, "targetUsername": string }` | Target's device is ringing. |
| `incoming_call` | Server ➔ Callee | `{ "type": "incoming_call", "callId": string, "callerUsername": string, "callerDisplayName": string }` | Alerts callee of incoming call. |
| `call_accept` | Callee ➔ Server | `{ "type": "call_accept", "callId": string }` | Callee accepts call. |
| `call_accepted` | Server ➔ Caller | `{ "type": "call_accepted", "callId": string, "startedAt": number }` | Informs caller to initiate WebRTC offer. |
| `offer` | Client ➔ Server ➔ Peer | `{ "type": "offer", "callId": string, "sdp": RTCSessionDescriptionInit }` | Relays WebRTC SDP offer. |
| `answer` | Client ➔ Server ➔ Peer | `{ "type": "answer", "callId": string, "sdp": RTCSessionDescriptionInit }` | Relays WebRTC SDP answer. |
| `ice_candidate` | Client ➔ Server ➔ Peer | `{ "type": "ice_candidate", "callId": string, "candidate": RTCIceCandidateInit }` | Relays ICE candidates (host, srflx, relay). |
| `call_end` | Client ➔ Server ➔ Peer | `{ "type": "call_end", "callId": string }` | Terminates call session; records duration. |
| `call_error` | Server ➔ Client | `{ "type": "call_error", "code": string, "message": string }` | Error notifications (`USER_BUSY`, `USER_OFFLINE`, `SELF_CALL`). |

---

## 3. WebRTC Audio Engine & Codec Tuning

Audio quality is configured directly in WebRTC track constraints:
```typescript
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
});
```

### Audio Characteristics:
- **Codec**: OPUS 48 kHz dynamic bitrate (16 kbps - 64 kbps).
- **Packet Loss Concealment (PLC)** & **In-band Forward Error Correction (FEC)** enabled natively in the browser's OPUS implementation.
- **DTLS-SRTP**: Audio packets are encrypted end-to-end between peer browser runtimes.

---

## 4. Diagnostics & RFC 8835 Telemetry

During an active call, the diagnostics panel samples `RTCPeerConnection.getStats()` every 2,000ms:
1. **Round-Trip Time (RTT)**: Extracted from `candidate-pair` report where `state === 'succeeded'`.
2. **Jitter & Packets Lost**: Extracted from `inbound-rtp` report.
3. **Calculated Bitrate (kbps)**: Computed as `(bytesReceived_now - bytesReceived_previous) * 8 / time_delta`.
4. **ICE Candidate Type**: Classifies connection into `host` (same local network), `srflx` (STUN reflexive NAT), or `relay` (TURN relay fallback).
