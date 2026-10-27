# Security, Privacy & TURN Relay Configuration

## 1. Security Architecture

### Authentication & Session Validation
- **Passwords**: Hashed with `bcrypt` (10 salt rounds).
- **Session Tokens**: Signed HMAC-SHA256 JWT tokens with 7-day expiration.
- **WebSocket Handshake**: Every WebSocket connection requires a valid JWT token in either the initial query string (`/ws?token=<jwt>`) or within an explicit `auth` frame before any signaling messages are processed.
- **Signaling Message Authorization**: Peers can only send SDP offers, answers, and ICE candidates to active call participants. Unrelated clients cannot inject media or eavesdrop on call metadata.

### Privacy & Data Retention
- **No Audio Recording by Default**: Direct audio flows peer-to-peer via DTLS-SRTP. The server acts purely as a signaling gateway and never sees, buffers, or records raw audio packets.
- **No Contact Harvesting**: No device contacts are scanned or synced without explicit user action.
- **Minimal Metadata**: Call records store only `caller`, `callee`, `status`, `startedAt`, `endedAt`, and `durationSeconds`.

---

## 2. STUN & TURN Relay Deployment

In peer-to-peer WebRTC, direct connections fail when users are behind symmetric NATs or strict cellular firewalls (often 10–20% of mobile connections). A TURN (Traversal Using Relays around NAT, RFC 5766) server guarantees connectivity.

### Option A: Self-Hosted Coturn on Ubuntu/Debian

1. **Install Coturn**:
   ```bash
   sudo apt update
   sudo apt install -y coturn
   ```

2. **Configure `/etc/turnserver.conf`**:
   ```ini
   # Network configuration
   listening-port=3478
   tls-listening-port=5349
   realm=turn.yourdomain.com

   # Media port range
   min-port=49152
   max-port=65535

   # Security & Fingerprints
   fingerprint
   lt-cred-mech
   use-auth-secret
   static-auth-secret=your_super_secret_turn_key_here

   # Performance & Logging
   no-cli
   no-tcp-relay
   syslog
   ```

3. **Open Firewall Ports**:
   ```bash
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 5349/udp
   sudo ufw allow 49152:65535/udp
   ```

4. **Start & Enable Service**:
   ```bash
   sudo systemctl restart coturn
   sudo systemctl enable coturn
   ```

### Option B: Docker Container Deployment

```bash
docker run -d --network=host \
  --name=coturn \
  coturn/coturn \
  -n --log-file=stdout \
  --min-port=49152 --max-port=65535 \
  --listening-port=3478 \
  --realm=turn.yourdomain.com \
  --user=turnuser:turnpassword
```

### Option C: Configuring in Voipify (`.env.local`)

Set the environment variables:
```env
TURN_URLS=turn:turn.yourdomain.com:3478?transport=udp
TURN_USERNAME=turnuser
TURN_CREDENTIAL=turnpassword
```

Voipify's `/api/ice-servers` endpoint securely serves these credentials exclusively to authenticated users.
