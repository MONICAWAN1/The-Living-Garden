import { io } from 'socket.io-client';

const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'; // ← point to your backend, not the Vite dev port

export const socket = io(SERVER_URL, {
  autoConnect: false,               // Garden controls when to connect
  transports: ['websocket'],        // avoid long-polling issues
  withCredentials: true,            // if your server uses cookies; okay to keep true
  path: '/socket.io',               // change only if your server uses a custom path
});
