import { Socket } from 'socket.io';

export interface Player {
  id: number;
  socket: Socket;
  username: string;
}
