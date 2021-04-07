import { GameRoomDto } from '../dto/GameRoomDto';
import { Player } from './Player';

export type GameState = 'NOT_STARTED' | 'STARTED';

export interface GameRoom {
  id: string;
  hostId: number;
  state: GameState;
  players: Player[];
}

export function gameRoomToDto(room: GameRoom): GameRoomDto {
  const dto: GameRoomDto = {
    id: room.id,
    hostId: room.hostId,
    state: room.state,
    players: room.players.map((player) => ({
      id: player.id,
      username: player.username,
    })),
  };
  return dto;
}
