"use client";

import { io, type Socket } from "socket.io-client";

let clientSocket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Socket can only be used in the browser");
  }
  if (!clientSocket) {
    clientSocket = io();
  }
  return clientSocket;
}

export function disconnectSocket(): void {
  if (clientSocket) {
    clientSocket.disconnect();
    clientSocket = null;
  }
}
