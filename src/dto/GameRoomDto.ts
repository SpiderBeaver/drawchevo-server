import { PlayerDto } from './PlayerDto';

export interface GameRoomDto {
  id: string;
  players: PlayerDto[];
}
