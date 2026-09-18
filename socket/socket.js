import { Server } from "socket.io";

export const Socket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
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
