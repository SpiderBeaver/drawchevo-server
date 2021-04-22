import { drawingToDto } from '../dto/DrawingDto';
import { GameRoomDto } from '../dto/GameRoomDto';
import { playerToDto } from '../dto/PlayerDto';
import { selectRandomElement } from '../utils/utils';
import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';

// TODO: Think about extracting socket interactions from this module.

export const DEFAULT_HOST_ID = 0;

export type GameState = 'NOT_STARTED' | 'DRAWING' | 'MAKING_FAKE_PHRASES' | 'VOTING' | 'SHOWING_VOTING_RESULTS';

export interface GameRoom {
  id: string;
  hostId: number;
  state: GameState;
  players: Player[];
  phrasesPool: string[];
  originalPhrases: Phrase[];
  drawings: { playerId: number; drawing: Drawing }[];
  fakePhrases: Phrase[];
  currentRoundPlayerId: number | null;
  finishedRoundsPlayersIds: number[];
  // TODO: Convert to map. Store phrase ID insted of text.
  votes: { playerId: number; phrase: string }[];
}

export function createRoom(host: Player, phrasesPool: string[]): GameRoom {
  const roomId = Math.random().toString(36).substr(2, 9);
  const room: GameRoom = {
    id: roomId,
    hostId: host.id,
    state: 'NOT_STARTED',
    players: [host],
    phrasesPool: phrasesPool,
    originalPhrases: [],
    drawings: [],
    fakePhrases: [],
    currentRoundPlayerId: null,
    finishedRoundsPlayersIds: [],
    votes: [],
  };
  const roomDto = gameRoomToDto(room, host.id);
  host.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  return room;
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

export function nextPlayerId(room: GameRoom): number {
  const nextPlayerId = Math.max(...room.players.map((p) => p.id)) + 1;
  return nextPlayerId;
}

export function addPlayer(room: GameRoom, newPlayer: Player) {
  room.players.push(newPlayer);

  const roomDto = gameRoomToDto(room, newPlayer.id);
  newPlayer.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  const newPlayerDto = playerToDto(newPlayer);

  room.players
    .filter((player) => player.id != newPlayer.id)
    .forEach((player) => {
      player.socket.emit('PLAYER_JOINED', { player: newPlayerDto });
    });
}

export function startDrawing(room: GameRoom) {
  room.state = 'DRAWING';
  room.originalPhrases = selectPhrases(
    room.players.map((p) => p.id),
    room.phrasesPool
  );
  room.players.forEach((player) => (player.status = 'drawing'));

  // NOTE: It's probably better to send just the phrases. But we can simply refresh the fame state as well.
  // NOTE: We don't want to send all the phrases to all the players. Just send the ones they need to draw.
  room.players.forEach((player) => {
    const roomDto = gameRoomToDto(room, player.id);
    player.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });
}

export function playerFinishedDrawing(room: GameRoom, drawingPlayer: Player, drawing: Drawing) {
  drawingPlayer.status = 'finished_drawing';
  room.drawings.push({ playerId: drawingPlayer.id, drawing: drawing });
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_DRAWING', { playerId: drawingPlayer.id });
  });

  const everyoneFinishedDrawing = room.players.every((player) => player.status === 'finished_drawing');
  if (everyoneFinishedDrawing) {
    startMakingFakePhrases(room);
  }
}

function startMakingFakePhrases(room: GameRoom) {
  const nextRoundPlayerId = selectNextRoundPlayer(room);
  if (nextRoundPlayerId !== null) {
    room.state = 'MAKING_FAKE_PHRASES';
    room.currentRoundPlayerId = nextRoundPlayerId;
    room.fakePhrases = [];
    const currentRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayerId)?.drawing;
    if (currentRoundDrawing) {
      const currentRoundDrawingDto = drawingToDto(currentRoundDrawing);
      room.players.forEach((player) => {
        player.status = 'making_fake_phrase';
        player.socket.emit('START_MAKING_FAKE_PHRASES', { drawing: currentRoundDrawingDto });
      });
    }
  }
}

function selectPhrases(playerIds: number[], allPhrases: string[]): Phrase[] {
  const phrases = playerIds.map(
    (playerId) =>
      ({
        playerId: playerId,
        text: selectRandomElement(allPhrases),
      } as Phrase)
  );
  return phrases;
}

export function playerFinishedFakePhrase(room: GameRoom, playerWithPhrase: Player, phraseText: string) {
  room.fakePhrases.push({ playerId: playerWithPhrase.id, text: phraseText });
  playerWithPhrase.status = 'finished_making_fake_phrase';
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_MAKING_FAKE_PHRASE', { playerId: playerWithPhrase.id });
  });

  if (room.players.every((player) => player.status == 'finished_making_fake_phrase')) {
    startVoting(room);
  }
}

function startVoting(room: GameRoom) {
  room.state = 'VOTING';
  room.votes = [];
  room.players.forEach((player) => {
    player.status = 'voting';
    // TODO: Maybe a better way is to send phrases with some kind of IDs.
    const voting_options = [...room.fakePhrases, currentOriginalPhrase(room)].map((phrase) => phrase.text);
    player.socket.emit('START_VOTING', { options: voting_options });
  });
}

function currentOriginalPhrase(room: GameRoom): Phrase {
  return room.originalPhrases.find((p) => p.playerId == room.currentRoundPlayerId)!;
}

export function playerVotedForPhrase(room: GameRoom, votedPlayer: Player, phrase: string) {
  votedPlayer.status = 'finished_voting';
  room.votes.push({ playerId: votedPlayer.id, phrase: phrase });
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_VOTING', { playerId: votedPlayer.id });
  });

  if (room.players.every((player) => player.status === 'finished_voting')) {
    showVotingResults(room);
  }
}

function showVotingResults(room: GameRoom) {
  room.state = 'SHOWING_VOTING_RESULTS';

  const originalPhrase = room.originalPhrases.find((phrase) => phrase.playerId === room.currentRoundPlayerId)!.text;
  room.players.forEach((player) => {
    player.socket.emit('SHOW_VOTING_RESULTS', { votes: room.votes, originalPhrase: originalPhrase });
  });
}

export function startNextRound(room: GameRoom) {
  room.finishedRoundsPlayersIds.push(room.currentRoundPlayerId!);
  const nextRoundPlayerId = selectNextRoundPlayer(room);
  if (nextRoundPlayerId !== null) {
    room.state = 'MAKING_FAKE_PHRASES';
    room.fakePhrases = [];
    room.currentRoundPlayerId = nextRoundPlayerId;
    const currentRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayerId)?.drawing;
    if (currentRoundDrawing) {
      const currentRoundDrawingDto = drawingToDto(currentRoundDrawing);
      room.players.forEach((player) => {
        player.status = 'making_fake_phrase';
        player.socket.emit('START_MAKING_FAKE_PHRASES', { drawing: currentRoundDrawingDto });
      });
    }
  }
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
