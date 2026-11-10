import { io } from "socket.io-client";

// Lấy URL của backend server (mặc định http://localhost:3000 khi dev)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  withCredentials: true,
});

export default socket;
