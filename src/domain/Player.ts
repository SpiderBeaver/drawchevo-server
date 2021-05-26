import { Socket } from 'socket.io';
import crypto from 'crypto';

export type PlayerStatus =
  | 'idle'
  | 'making_phrase'
  | 'finished_phrase'
  | 'drawing'
  | 'finished_drawing'
  | 'making_fake_phrase'
  | 'finished_making_fake_phrase'
  | 'voting'
  | 'finished_voting';

export interface Player {
  id: number;
  socket: Socket;
  // TODO: Maybe combine token with ID.
  token: string;
  username: string;
  status: PlayerStatus;
}

export function createPlayer(id: number, username: string, socket: Socket): Player {
  const playerToken = crypto.randomBytes(24).toString('hex');
  const player: Player = { id: id, socket: socket, token: playerToken, username: username, status: 'idle' };
  socket.emit('ASSING_PLAYER_ID', { playerId: id });
  socket.emit('ASSIGN_PLAYER_TOKEN', { token: player.token });
  return player;
}
