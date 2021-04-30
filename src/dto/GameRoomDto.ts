import { GameState } from '../domain/GameRoom';
import { PhraseDto } from './PhraseDto';
import { PlayerDto } from './PlayerDto';

export interface GameRoomDto {
  id: string;
  hostId: number;
  state: GameState;
  players: PlayerDto[];
  originalPhrase: PhraseDto | null;
}
