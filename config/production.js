const https = require("https");
const http = require("http");
const fs = require("fs");
const socketHandler = require("../socket"); // Correctly point to your socket file

exports.startServer = (app) => {
  // HTTP to HTTPS redirection
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
      console.log("HTTP redirect server running on port", process.env.HTTP_PORT || 8080);
    });

  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  };

  const server = https.createServer(sslOptions, app).listen(process.env.HTTPS_PORT || 8443, () => {
    console.log("HTTPS server running on port", process.env.HTTPS_PORT || 8443);
  });

  // Initialize and setup Socket.IO
  const io = socketHandler.init(server);

  io.on("connection", (socket) => {
    console.log("Client connected with ID:", socket.id);

    socket.on("userConnected", (data) => {
      console.log("User connected:", data);
      socket.userId = data.userId;
      socket.userType = data.userType;
      socket.emit("connectionConfirmed", {
        message: "Successfully connected",
        userId: data.userId,
        userType: data.userType,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });
};
