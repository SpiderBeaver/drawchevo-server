import { Socket } from 'socket.io';

export type PlayerStatus =
  | 'idle'
  | 'drawing'
  | 'finished_drawing'
  | 'making_fake_phrase'
  | 'finished_making_fake_phrase';

export interface Player {
  id: number;
  socket: Socket;
  username: string;
  status: PlayerStatus;
}
