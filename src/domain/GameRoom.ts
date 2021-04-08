import { GameRoomDto } from '../dto/GameRoomDto';
import { selectRandomElement } from '../utils/utils';
import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';

export type GameState = 'NOT_STARTED' | 'DRAWING';

export interface GameRoom {
  id: string;
  hostId: number;
  state: GameState;
  players: Player[];
  originalPhrases: Phrase[];
  drawings: { playerId: number; drawing: Drawing }[];
}

export function gameRoomToDto(room: GameRoom, currentPlayerId: number): GameRoomDto {
  const dto: GameRoomDto = {
    id: room.id,
    hostId: room.hostId,
    state: room.state,
    players: room.players.map((player) => ({
      id: player.id,
      username: player.username,
      status: player.status,
    })),
    originalPhrase: room.originalPhrases.find((p) => p.playerId === currentPlayerId)?.text,
  };
  return dto;
}

export function selectPhrases(playerIds: number[], allPhrases: string[]): Phrase[] {
  const phrases = playerIds.map(
    (playerId) =>
      ({
        playerId: playerId,
        text: selectRandomElement(allPhrases),
      } as Phrase)
  );
  return phrases;
}
