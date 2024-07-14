const child_process = require("child_process"); // To be used later for running FFmpeg
const express = require("express");
const { Server } = require("socket.io");
const app = express();
const cors = require("cors");

require("dotenv").config();

const { inputSettings, youtubeSettings } = require("./ffmpeg");

app.use(cors());
app.use(express.static("public"));
app.use(express.json({ limit: "200mb", extended: true }));
app.use(
  express.urlencoded({ limit: "200mb", extended: true, parameterLimit: 50000 })
);

const authenticationRouter = require("./routes/authentication");
const broadcastsRouter = require("./routes/broadcasts");
const emailEventNotificationsRouter = require("./routes/emailEventNotifications");
const referralRouter = require("./routes/referral");
const youtubeAuthorizationRouter = require("./routes/youtubeAuthorization");
const youtubeBroadcastRouter = require("./routes/youtubeBroadcast");
const youtubeViewCountRouter = require("./routes/youtubeViewCount");

app.use("/", authenticationRouter);
app.use("/", broadcastsRouter);
app.use("/", emailEventNotificationsRouter);
app.use("/", referralRouter);
app.use("/", youtubeAuthorizationRouter);
app.use("/", youtubeBroadcastRouter);
app.use("/", youtubeViewCountRouter);

// Incase if we need to get port from env
const PORT = process.env.PORT || 5001;
const WS_PORT = process.env.PORT || 3001;

const io = new Server(3001, {
  /* options */
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("socket: ", socket);
  console.log(`socket connected to ${socket.id}`);

  const socketQueryParams = socket.handshake.query;
  console.log("socketQueryParams: ", socketQueryParams);

  const youtube = socketQueryParams.youtubeUrl;
  console.log("youtube: ", youtube);

  const ffmpegInput = inputSettings.concat(youtubeSettings(youtube));

  const ffmpeg = child_process.spawn("ffmpeg", ffmpegInput);

  // If FFmpeg stops for any reason, close the WebSocket connection.
  ffmpeg.on("close", (code, signal) => {
    console.log(
      "FFmpeg child process closed, code " + code + ", signal " + signal
    );
  });

  // Handle STDIN pipe errors by logging to the console.
  // These errors most commonly occur when FFmpeg closes and there is still
  // data to write.  If left unhandled, the server will crash.
  ffmpeg.stdin.on("error", (e) => {
    console.log("FFmpeg STDIN Error", e);
  });

  // FFmpeg outputs all of its messages to STDERR.  Let's log them to the console.
  ffmpeg.stderr.on("data", (data) => {
    console.log("FFmpeg STDERR:", data.toString());
  });

  // When data comes in from the WebSocket, write it to FFmpeg's STDIN.
  socket.on("message", (msg) => {
    console.log("DATA", msg);
    ffmpeg.stdin.write(msg);
  });
  socket.on("hello", (msg) => {
    console.log("hello", msg);
  });

  // If the client disconnects, stop FFmpeg.
  socket.conn.on("close", (e) => {
    console.log("kill: SIGINT, soocket closed");
    ffmpeg.kill("SIGINT");
  });
});
