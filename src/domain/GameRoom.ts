import { drawingToDto } from '../dto/DrawingDto';
import { GameRoomDto } from '../dto/GameRoomDto';
import { phraseToDto } from '../dto/PhraseDto';
import { playerToDto } from '../dto/PlayerDto';
import { voteToDto } from '../dto/VoteDto';
import { selectRandomElement, shuffle } from '../utils/utils';
import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';
import { getPhraseByAuthorId, getPhraseByText, newRound, Round } from './Round';

// TODO: Think about extracting socket interactions from this module.

export const DEFAULT_HOST_ID = 0;

export type GameState =
  | 'NOT_STARTED'
  | 'MAKING_PHRASES'
  | 'DRAWING'
  | 'MAKING_FAKE_PHRASES'
  | 'VOTING'
  | 'SHOWING_VOTING_RESULTS';

export interface GameRoom {
  id: string;
  hostId: number;
  state: GameState;
  players: Player[];
  originalPhrases: Phrase[];
  drawings: { playerId: number; drawing: Drawing }[];
  finishedRoundsPlayersIds: number[];
  currentRound: Round | null;
}

export function createRoom(host: Player): GameRoom {
  const roomId = generateRoomId();
  const room: GameRoom = {
    id: roomId,
    hostId: host.id,
    state: 'NOT_STARTED',
    players: [host],
    originalPhrases: [],
    drawings: [],
    finishedRoundsPlayersIds: [],
    currentRound: null,
  };
  const roomDto = gameRoomToDto(room, host.id);
  host.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  return room;
}

function generateRoomId(): string {
  const id = Math.floor(100000 + Math.random() * 900000);
  return id.toString();
}

export function gameRoomToDto(room: GameRoom, currentPlayerId: number): GameRoomDto {
  const originalPhrase = room.originalPhrases.find((p) => p.drawingPlayerId === currentPlayerId) ?? null;
  const originalPhraseDto = originalPhrase ? phraseToDto(originalPhrase) : null;
  const dto: GameRoomDto = {
    id: room.id,
    hostId: room.hostId,
    state: room.state,
    players: room.players.map((player) => ({
      id: player.id,
      username: player.username,
      status: player.status,
    })),
    originalPhrase: originalPhraseDto,
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

export function startMakingPhrases(room: GameRoom) {
  room.state = 'MAKING_PHRASES';
  room.players.forEach((player) => (player.status = 'making_phrase'));

  room.players.forEach((player) => {
    player.socket.emit('START_MAKING_PHRASE');
  });
}

export function playerFinishedPhrase(room: GameRoom, playerWithPhrase: Player, phraseText: string) {
  const phrase: Phrase = { authorId: playerWithPhrase.id, drawingPlayerId: null, text: phraseText };
  room.originalPhrases.push(phrase);

  playerWithPhrase.status = 'finished_phrase';

  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_PHRASE', { playerId: playerWithPhrase.id });
  });

  const everyoneFinishedPhrases = room.players.every((player) => player.status === 'finished_phrase');
  if (everyoneFinishedPhrases) {
    startDrawing(room);
  }
}

export function startDrawing(room: GameRoom) {
  room.state = 'DRAWING';
  room.players.forEach((player) => (player.status = 'drawing'));

  assignPhrasesToPlayersForDrawing(room);

  // NOTE: It's probably better to send just the phrases. But we can simply refresh the fame state as well.
  // NOTE: We don't want to send all the phrases to all the players. Just send the ones they need to draw.
  room.players.forEach((player) => {
    const roomDto = gameRoomToDto(room, player.id);
    player.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });
}

function assignPhrasesToPlayersForDrawing(room: GameRoom) {
  const playersIds = shuffle(room.players.map((player) => player.id));
  for (let i = 0; i < playersIds.length; i++) {
    const authorId = playersIds[i];
    const drawingPlayerId = i + 1 < playersIds.length ? playersIds[i + 1] : playersIds[0];
    const phrase = room.originalPhrases.find((phrase) => phrase.authorId === authorId)!;
    phrase.drawingPlayerId = drawingPlayerId;
  }
}

export function playerFinishedDrawing(room: GameRoom, drawingPlayer: Player, drawing: Drawing) {
  drawingPlayer.status = 'finished_drawing';
  room.drawings.push({ playerId: drawingPlayer.id, drawing: drawing });
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_DRAWING', { playerId: drawingPlayer.id });
  });

  const everyoneFinishedDrawing = room.players.every((player) => player.status === 'finished_drawing');
  if (everyoneFinishedDrawing) {
    startNextRound(room);
  }
}

export function startNextRound(room: GameRoom) {
  if (room.currentRound != null) {
    room.finishedRoundsPlayersIds.push(room.currentRound.roundPlayer.id);
  }

  const nextRoundPlayer = selectNextRoundPlayer(room);
  if (nextRoundPlayer !== null) {
    const newRoundOriginalPhrase = room.originalPhrases.find((p) => p.drawingPlayerId === nextRoundPlayer.id)!;
    const newRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayer.id)?.drawing!;
    room.currentRound = newRound(nextRoundPlayer, newRoundOriginalPhrase, newRoundDrawing);
    startMakingFakePhrases(room);
  }
}

function startMakingFakePhrases(room: GameRoom) {
  const currentRound = room.currentRound!;
  room.state = 'MAKING_FAKE_PHRASES';
  const currentRoundDrawingDto = drawingToDto(currentRound.drawing);
  const currentRoundOriginalPhraseDro = phraseToDto(currentRound.originalPhrase);
  room.players.forEach((player) => {
    player.status = 'making_fake_phrase';
    player.socket.emit('START_MAKING_FAKE_PHRASES', {
      currentPlayerId: currentRound.roundPlayer.id,
      originalPhrase: currentRoundOriginalPhraseDro,
      drawing: currentRoundDrawingDto,
    });
  });
}

export function playerFinishedFakePhrase(room: GameRoom, playerWithPhrase: Player, phraseText: string) {
  const currentRound = room.currentRound!;

  currentRound.fakePhrases.push({
    authorId: playerWithPhrase.id,
    drawingPlayerId: currentRound.roundPlayer.id,
    text: phraseText,
  });
  playerWithPhrase.status = 'finished_making_fake_phrase';
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_MAKING_FAKE_PHRASE', { playerId: playerWithPhrase.id });
  });

  const everyoneDone = room.players
    .filter((player) => player.id !== currentRound.roundPlayer.id)
    .filter((player) => player.id !== currentRound.originalPhrase.authorId)
    .every((player) => player.status == 'finished_making_fake_phrase');
  if (everyoneDone) {
    startVoting(room);
  }
}

function startVoting(room: GameRoom) {
  const currentRound = room.currentRound!;
  room.state = 'VOTING';
  room.players.forEach((player) => {
    player.status = 'voting';
    // TODO: Maybe a better way is to send phrases with some kind of IDs.
    const phrases = [...currentRound.fakePhrases, currentRound.originalPhrase];
    const phrasesDto = phrases.map((phrase) => phraseToDto(phrase));
    player.socket.emit('START_VOTING', { phrases: phrasesDto });
  });
}

export function playerVotedForPhrase(room: GameRoom, votedPlayer: Player, phrasePlayerId: number) {
  const currentRound = room.currentRound!;
  votedPlayer.status = 'finished_voting';
  const votedPhrase = getPhraseByAuthorId(currentRound, phrasePlayerId)!;
  currentRound.votes.push({ playerId: votedPlayer.id, phrase: votedPhrase });
  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_VOTING', { playerId: votedPlayer.id });
  });

  // If a player is an author of the original phrase or a drawing author they don't vote.
  const playersToVote = room.players.filter(
    (player) => player.id !== currentRound.originalPhrase.authorId && player.id !== currentRound.roundPlayer.id
  );
  const everyoneVoted = playersToVote.every((player) => player.status === 'finished_voting');
  if (everyoneVoted) {
    showVotingResults(room);
  }
}

function showVotingResults(room: GameRoom) {
  const currentRound = room.currentRound!;
  room.state = 'SHOWING_VOTING_RESULTS';
  room.players.forEach((player) => {
    player.socket.emit('SHOW_VOTING_RESULTS', {
      votes: currentRound.votes.map((vote) => voteToDto(vote)),
      originalPhrase: phraseToDto(currentRound.originalPhrase),
    });
  });
}

export function selectNextRoundPlayer(room: GameRoom): Player | null {
  const playersIds = room.players.map((player) => player.id);
  const availablePlayersIds = playersIds.filter((id) => !room.finishedRoundsPlayersIds.includes(id));
  if (availablePlayersIds.length === 0) {
    return null;
  }
  const nextRoundPlayerId = selectRandomElement(availablePlayersIds);
  const nextRoundPlayer = room.players.find((p) => p.id === nextRoundPlayerId) ?? null;
  return nextRoundPlayer;
}
