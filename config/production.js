const https = require("https");
const http = require("http");
const fs = require("fs");
const socketHandler = require("../socket");

exports.startServer = (app) => {
  // HTTP → HTTPS redirect server
  http
    .createServer((req, res) => {
      const host = req.headers["host"];
      if (host) {
        res.writeHead(301, { Location: `https://${host.replace(/:\d+/, ":8443")}${req.url}` });
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.write("Bad Request: Missing Host header");
      }
      res.end();
    })
    .listen(process.env.HTTP_PORT || 8080, () => {
      console.log("[prod] HTTP redirect server running on port", process.env.HTTP_PORT || 8080);
    });

  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  };

  const server = https.createServer(sslOptions, app).listen(process.env.HTTPS_PORT || 8443, () => {
    console.log("[prod] HTTPS server running on port", process.env.HTTPS_PORT || 8443);
  });

  // Initialize Socket.IO on the server.
  // The connection handler is registered in app.js AFTER this returns,
  // so we do NOT attach any io.on('connection') here to avoid duplicates.
  socketHandler.init(server);
};
