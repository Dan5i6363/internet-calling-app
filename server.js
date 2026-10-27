const http = require('http');
const next = require('next');
const { SignalingServer } = require('./server/signaling');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  // Attach WebSocket signaling server to the HTTP server
  const signaling = new SignalingServer(server);

  server.listen(port, () => {
    console.log(`> Internet Calling App ready on http://localhost:${port}`);
    console.log(`> WebSocket Signaling active on ws://localhost:${port}/ws`);
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
