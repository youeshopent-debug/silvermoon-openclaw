// Start mcp-chrome server directly (without native messaging host)
const server = require("C:\\Users\\User\\AppData\\Roaming\\npm\\node_modules\\mcp-chrome-bridge\\dist\\server\\index.js").default;

server.start(12306).then(() => {
  console.log("[mcp-chrome] HTTP server started on http://127.0.0.1:12306/mcp");
  console.log("[mcp-chrome] Ping: http://127.0.0.1:12306/ping");

  // Keep process alive
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}).catch(err => {
  console.error("[mcp-chrome] Failed to start:", err.message);
  process.exit(1);
});
