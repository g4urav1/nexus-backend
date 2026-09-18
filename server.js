import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import "dotenv/config";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import postRoutes from "./routes/post.routes.js";
import socialRoutes from "./routes/social.routes.js";
import passwordRoutes from "./routes/password.routes.js";

import { Socket } from "./socket/socket.js";

import http from "http";

const app = express();
const server = http.createServer(app);

const io = Socket(server);

app.set("io", io);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.use(cookieParser());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connected:", mongoose.connection.name);
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.use("/", authRoutes);

app.use("/", userRoutes);

app.use("/", postRoutes);

app.use("/", socialRoutes);

app.use("/", passwordRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(400).json({
    message: err.message,
  });
});

app.get("/randomroute", (req, res) => {
  io.emit("randomRouteHit", "Someone just hit the randomroute route!");
  res.status(200).json({ message: "hmm!!!" });
});

server.listen(1111, () => {
  console.log("http://localhost:1111");
});
