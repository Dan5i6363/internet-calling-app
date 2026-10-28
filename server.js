const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const http = require('http');
const next = require('next');
const { SignalingServer } = require('./server/signaling');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    // Ultra-fast health check probe for cloud load balancers / Render
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()) }));
      return;
    }

    handle(req, res);
  });

  // Attach WebSocket signaling server to the HTTP server
  const signaling = new SignalingServer(server);

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Internet Calling App ready on http://0.0.0.0:${port}`);
    console.log(`> WebSocket Signaling active on ws://0.0.0.0:${port}/ws`);
  });

  const cleanup = () => {
    console.log('\nShutting down server...');
    signaling.close();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}).catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});
