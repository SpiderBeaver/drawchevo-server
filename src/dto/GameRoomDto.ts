import { GameState } from '../domain/GameRoom';
import { PlayerDto } from './PlayerDto';

export interface GameRoomDto {
  id: string;
  hostId: number;
  state: GameState;
  players: PlayerDto[];
  originalPhrase: string | null;
}
