import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import mongoose from "mongoose";

export const Socket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  // Socket authentication
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");

      const token = cookies.jwt;

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const payload = jwt.verify(token, "userIdKey");

      console.log(payload);

      const conversations = await mongoose.connection.db
        .collection("conversations")
        .find({
          participants: new mongoose.Types.ObjectId(payload.userId),
        })
        .toArray();

      const convRooms = conversations.map((conversation) =>
        conversation._id.toString(),
      );

      convRooms.forEach((conversationId) => {
        socket.join(`conversation:${conversationId}`);
      });

      // Store user ID on socket
      socket.userId = payload.userId;

      next();
    } catch (error) {
      console.log("Socket authentication failed:", error.message);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(socket.id, "connected");

    socket.emit("welcome", "Welcome to Nexus socket server.");

    socket.on("disconnect", () => {
      console.log(socket.id, "disconnected");
    });
  });

  return io;
};
