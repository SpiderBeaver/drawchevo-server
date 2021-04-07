import { PlayerDto } from './PlayerDto';

export interface GameRoomDto {
  id: string;
  hostId: number;
  players: PlayerDto[];
}
