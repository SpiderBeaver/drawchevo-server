import { Socket } from 'socket.io';

export type PlayerStatus =
  | 'idle'
  | 'drawing'
  | 'finished_drawing'
  | 'making_fake_phrase'
  | 'finished_making_fake_phrase'
  | 'voting'
  | 'finished_voting';

export interface Player {
  id: number;
  socket: Socket;
  username: string;
  status: PlayerStatus;
}

export function createPlayer(id: number, username: string, socket: Socket): Player {
  const player: Player = { id: id, socket: socket, username: username, status: 'idle' };
  socket.emit('ASSING_PLAYER_ID', { playerId: id });
  return player;
}
