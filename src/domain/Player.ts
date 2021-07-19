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
  // TODO: Maybe combine token with ID.
  token: string;
  username: string;
  status: PlayerStatus;
  points: number;
}

export function createPlayer(id: number, username: string): Player {
  const playerToken = crypto.randomBytes(24).toString('hex');
  const player: Player = { id: id, token: playerToken, username: username, status: 'idle', points: 0 };
  return player;
}
