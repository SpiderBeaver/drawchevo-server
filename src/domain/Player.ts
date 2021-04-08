import { Socket } from 'socket.io';

export type PlayerStatus = 'idle' | 'drawing' | 'finished_drawing';

export interface Player {
  id: number;
  socket: Socket;
  username: string;
  status: PlayerStatus;
}
