import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import useAuthStore from "../stores/authstore";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      // Disconnect if no token
      setSocket((currentSocket) => {
        if (currentSocket) {
          currentSocket.disconnect();
        }
        return null;
      });
      setIsConnected(false);
      return;
    }

    // Get base URL from environment or default
    const getBaseURL = () => {
      const envURL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const cleanURL = envURL.replace(/\/$/, "");
      return cleanURL;
    };

    const baseURL = getBaseURL();

    // Create socket connection
    const newSocket = io(baseURL, {
      auth: {
        token: accessToken,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket.io connected");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket.io disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount or when dependencies change
    return () => {
      newSocket.close();
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
