import { GameRoomDto } from '../dto/GameRoomDto';
import { selectRandomElement } from '../utils/utils';
import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';

export type GameState = 'NOT_STARTED' | 'DRAWING' | 'MAKING_FAKE_PHRASES';

export interface GameRoom {
  id: string;
  hostId: number;
  state: GameState;
  players: Player[];
  originalPhrases: Phrase[];
  drawings: { playerId: number; drawing: Drawing }[];
  fakePhrases: Phrase[];
  currentRoundPlayerId: number | null;
  finishedRoundsPlayersIds: number[];
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
    originalPhrase: room.originalPhrases.find((p) => p.playerId === currentPlayerId)?.text ?? null,
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

export function selectNextRoundPlayer(room: GameRoom): number | null {
  const playersIds = room.players.map((player) => player.id);
  const availablePlayersIds = playersIds.filter((id) => !room.finishedRoundsPlayersIds.includes(id));
  if (availablePlayersIds.length === 0) {
    return null;
  }
  const nextRoundPlayerId = selectRandomElement(availablePlayersIds);
  return nextRoundPlayerId;
}
