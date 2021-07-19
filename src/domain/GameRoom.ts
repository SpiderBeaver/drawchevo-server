import assert from 'assert';
import produce from 'immer';
import { drawingToDto } from '../dto/DrawingDto';
import { GameRoomDto } from '../dto/GameRoomDto';
import { phraseToDto } from '../dto/PhraseDto';
import { playerToDto } from '../dto/PlayerDto';
import { voteToDto } from '../dto/VoteDto';
import { selectRandomElement, shuffle } from '../utils/utils';
import Drawing from './Drawing';
import { createPhrase, Phrase } from './Phrase';
import { Player } from './Player';
import { createRound, Round } from './Round';

// TODO: Think about extracting socket interactions from this module.

export const DEFAULT_HOST_ID = 0;

export type GameState =
  | 'NOT_STARTED'
  | 'MAKING_PHRASES'
  | 'DRAWING'
  | 'MAKING_FAKE_PHRASES'
  | 'VOTING'
  | 'SHOWING_VOTING_RESULTS'
  | 'ENDED';

type DrawingAssingment = Readonly<{
  playerId: number;
  phraseId: number;
}>;

type PlayerDrawing = Readonly<{
  playerId: number;
  drawing: Drawing;
}>;

type GameRoomNotStarted = Readonly<{
  id: string;
  hostId: number;
  state: 'NOT_STARTED';
  players: ReadonlyArray<Player>;
}>;

type GameRoomMakingPhrases = Readonly<{
  id: string;
  hostId: number;
  state: 'MAKING_PHRASES';
  players: ReadonlyArray<Player>;
  originalPhrases: ReadonlyArray<Phrase>;
}>;

type GameRoomDrawing = Readonly<{
  id: string;
  hostId: number;
  state: 'DRAWING';
  players: ReadonlyArray<Player>;
  originalPhrases: ReadonlyArray<Phrase>;
  drawingAssignments: ReadonlyArray<DrawingAssingment>;
  drawings: ReadonlyArray<PlayerDrawing>;
}>;

type GameRoomMakingFakePhrases = Readonly<{
  id: string;
  hostId: number;
  state: 'MAKING_FAKE_PHRASES';
  players: ReadonlyArray<Player>;
  originalPhrases: ReadonlyArray<Phrase>;
  drawingAssignments: ReadonlyArray<DrawingAssingment>;
  drawings: ReadonlyArray<PlayerDrawing>;
  currentRound: Round;
  finishedRoundsPlayersIds: ReadonlyArray<number>;
}>;

type GameRoomVoting = Readonly<{
  id: string;
  hostId: number;
  state: 'VOTING';
  players: ReadonlyArray<Player>;
  originalPhrases: ReadonlyArray<Phrase>;
  drawingAssignments: ReadonlyArray<DrawingAssingment>;
  drawings: ReadonlyArray<PlayerDrawing>;
  currentRound: Round;
  finishedRoundsPlayersIds: ReadonlyArray<number>;
}>;

type GameRoomShowingVotingResults = Readonly<{
  id: string;
  hostId: number;
  state: 'SHOWING_VOTING_RESULTS';
  players: ReadonlyArray<Player>;
  originalPhrases: ReadonlyArray<Phrase>;
  drawingAssignments: ReadonlyArray<DrawingAssingment>;
  drawings: ReadonlyArray<PlayerDrawing>;
  currentRound: Round;
  finishedRoundsPlayersIds: ReadonlyArray<number>;
}>;

type GameRoomEnded = Readonly<{
  id: string;
  hostId: number;
  state: 'ENDED';
  players: ReadonlyArray<Player>;
}>;

export type GameRoom =
  | GameRoomNotStarted
  | GameRoomMakingPhrases
  | GameRoomDrawing
  | GameRoomMakingFakePhrases
  | GameRoomVoting
  | GameRoomShowingVotingResults
  | GameRoomEnded;

export function createRoom(host: Player): GameRoom {
  const roomId = generateRoomId();
  const room: GameRoom = {
    id: roomId,
    hostId: host.id,
    state: 'NOT_STARTED',
    players: [host],
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
  const originalPhraseId =
    'drawingAssignments' in room ? room.drawingAssignments.find((a) => a.playerId === currentPlayerId)?.phraseId : null;
  const originalPhrase = 'originalPhrases' in room ? room.originalPhrases.find((p) => p.id === originalPhraseId) : null;
  const originalPhraseDto = originalPhrase ? phraseToDto(originalPhrase) : null;
  const dto: GameRoomDto = {
    id: room.id,
    hostId: room.hostId,
    state: room.state,
    players: room.players.map((player) => playerToDto(player)),
    originalPhrase: originalPhraseDto,
  };
  return dto;
}

export function nextPlayerId(room: GameRoom): number {
  const nextPlayerId = Math.max(...room.players.map((p) => p.id)) + 1;
  return nextPlayerId;
}

export function addPlayer(room: GameRoom, newPlayer: Player): GameRoom {
  const newRoom = produce(room, (draft) => {
    draft.players.push(newPlayer);
  });

  const roomDto = gameRoomToDto(newRoom, newPlayer.id);
  newPlayer.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  const newPlayerDto = playerToDto(newPlayer);

  newRoom.players
    .filter((player) => player.id != newPlayer.id)
    .forEach((player) => {
      player.socket.emit('PLAYER_JOINED', { player: newPlayerDto });
    });

  return newRoom;
}

export function startMakingPhrases(room: GameRoomNotStarted): GameRoomMakingPhrases {
  const roomMakingPhrases: GameRoomMakingPhrases = { ...room, state: 'MAKING_PHRASES', originalPhrases: [] };
  const roomWithPlayersUpdated = produce(roomMakingPhrases, (draft) => {
    draft.players.forEach((player) => (player.status = 'making_phrase'));
  });

  roomWithPlayersUpdated.players.forEach((player) => {
    player.socket.emit('START_MAKING_PHRASE');
  });

  return roomWithPlayersUpdated;
}

export function playerFinishedPhrase(
  room: GameRoomMakingPhrases,
  playerWithPhraseId: number,
  phraseText: string
): GameRoomMakingPhrases | GameRoomDrawing {
  const newPhrase = createPhrase(playerWithPhraseId, phraseText);
  const roomWithPhrase: GameRoomMakingPhrases = produce(room, (draft) => {
    draft.originalPhrases.push(newPhrase);
    draft.players.find((p) => p.id === playerWithPhraseId)!.status = 'finished_phrase';
  });

  roomWithPhrase.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_PHRASE', { playerId: playerWithPhraseId });
  });

  const everyoneFinishedPhrases = roomWithPhrase.players.every((player) => player.status === 'finished_phrase');
  if (everyoneFinishedPhrases) {
    const roomDrawing = startDrawing(roomWithPhrase);
    return roomDrawing;
  } else {
    return roomWithPhrase;
  }
}

export function startDrawing(room: GameRoomMakingPhrases): GameRoomDrawing {
  const roomDrawing: GameRoomDrawing = { ...room, state: 'DRAWING', drawingAssignments: [], drawings: [] };
  const drawingAssignments = generateDrawingAssingments(roomDrawing);
  const roomWithPhrasesAssigned = produce(roomDrawing, (draft) => {
    draft.drawingAssignments = drawingAssignments;
    draft.players.forEach((player) => (player.status = 'drawing'));
  });

  // NOTE: It's probably better to send just the phrases. But we can simply refresh the whole state as well.
  // NOTE: We don't want to send all the phrases to all the players. Just send the ones they need to draw.
  roomWithPhrasesAssigned.players.forEach((player) => {
    const roomDto = gameRoomToDto(roomWithPhrasesAssigned, player.id);
    player.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });

  return roomWithPhrasesAssigned;
}

function generateDrawingAssingments(room: GameRoomDrawing): DrawingAssingment[] {
  const assingmets: DrawingAssingment[] = [];
  const playersIds = shuffle(room.players.map((player) => player.id));
  for (let i = 0; i < playersIds.length; i++) {
    const authorId = playersIds[i];
    const drawingPlayerId = i + 1 < playersIds.length ? playersIds[i + 1] : playersIds[0];
    const phrase = room.originalPhrases.find((phrase) => phrase.authorId === authorId)!;
    assingmets.push({ playerId: drawingPlayerId, phraseId: phrase.id });
  }
  return assingmets;
}

export function playerFinishedDrawing(
  room: GameRoomDrawing,
  drawingPlayerId: number,
  drawing: Drawing
): GameRoomDrawing | GameRoomMakingFakePhrases {
  const playerDrawing = { playerId: drawingPlayerId, drawing: drawing };
  const roomWithNewPlayerDrawing = produce(room, (draft) => {
    draft.drawings.push(playerDrawing);
    draft.players.find((p) => p.id === drawingPlayerId)!.status = 'finished_drawing';
  });

  roomWithNewPlayerDrawing.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_DRAWING', { playerId: drawingPlayerId });
  });

  const everyoneFinishedDrawing = roomWithNewPlayerDrawing.players.every(
    (player) => player.status === 'finished_drawing'
  );
  if (everyoneFinishedDrawing) {
    const roomMakingFakePhrases = startFirstRound(roomWithNewPlayerDrawing);
    return roomMakingFakePhrases;
  } else {
    return roomWithNewPlayerDrawing;
  }
}

export function startFirstRound(room: GameRoomDrawing): GameRoomMakingFakePhrases {
  const firstRound = createFirstRound(room);
  const roomMakingPhrases: GameRoomMakingFakePhrases = {
    ...room,
    state: 'MAKING_FAKE_PHRASES',
    currentRound: firstRound,
    finishedRoundsPlayersIds: [],
  };
  const roomWithPlayersUpdated = produce(roomMakingPhrases, (draft) => {
    draft.players.forEach((player) => {
      player.status = 'making_fake_phrase';
    });
  });
  notifyPlayersAboutMakingFakePhrases(roomWithPlayersUpdated);
  return roomWithPlayersUpdated;
}

function createFirstRound(room: GameRoomDrawing): Round {
  const nextRoundPlayer = selectNextRoundPlayer(room)!;
  const nextRoundOriginalPhraseId = room.drawingAssignments.find((a) => a.playerId === nextRoundPlayer.id)!.phraseId;
  const newRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayer.id)!.drawing;
  const newRound = createRound(nextRoundPlayer.id, nextRoundOriginalPhraseId, newRoundDrawing);
  return newRound;
}

export function startNextRound(room: GameRoomShowingVotingResults): GameRoomMakingFakePhrases | GameRoomEnded {
  const roomWithUpdatedFinishedPlayers: GameRoomShowingVotingResults = {
    ...room,
    finishedRoundsPlayersIds: [...room.finishedRoundsPlayersIds, room.currentRound.roundPlayerId],
  };
  const nextRound = createNextRound(roomWithUpdatedFinishedPlayers);
  if (nextRound) {
    const roomMakingPhrases: GameRoomMakingFakePhrases = {
      ...roomWithUpdatedFinishedPlayers,
      state: 'MAKING_FAKE_PHRASES',
      currentRound: nextRound,
    };
    const roomWithPlayersUpdated = produce(roomMakingPhrases, (draft) => {
      draft.players.forEach((player) => {
        player.status = 'making_fake_phrase';
      });
    });
    notifyPlayersAboutMakingFakePhrases(roomWithPlayersUpdated);
    return roomWithPlayersUpdated;
  } else {
    const roomEnded: GameRoomEnded = { ...room, state: 'ENDED' };
    return roomEnded;
  }
}

function createNextRound(room: GameRoomShowingVotingResults) {
  const nextRoundPlayer = selectNextRoundPlayer(room);
  if (nextRoundPlayer !== null) {
    const nextRoundOriginalPhraseId = room.drawingAssignments.find((a) => a.playerId === nextRoundPlayer.id)!.phraseId;
    const newRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayer.id)!.drawing;
    const newRound = createRound(nextRoundPlayer.id, nextRoundOriginalPhraseId, newRoundDrawing);
    return newRound;
  } else {
    return null;
  }
}

function notifyPlayersAboutMakingFakePhrases(room: GameRoomMakingFakePhrases) {
  const currentRound = room.currentRound!;
  const currentRoundDrawingDto = drawingToDto(currentRound.drawing);
  const currentRoundOriginalPhrase = room.originalPhrases.find((p) => p.id === currentRound.originalPhraseId)!;
  const currentRoundOriginalPhraseDro = phraseToDto(currentRoundOriginalPhrase);
  room.players.forEach((player) => {
    player.socket.emit('START_MAKING_FAKE_PHRASES', {
      currentPlayerId: currentRound.roundPlayerId,
      originalPhrase: currentRoundOriginalPhraseDro,
      drawing: currentRoundDrawingDto,
    });
  });
}

export function playerFinishedFakePhrase(
  room: GameRoomMakingFakePhrases,
  playerWithPhraseId: number,
  phraseText: string
): GameRoomMakingFakePhrases | GameRoomVoting {
  const fakePhrase = createPhrase(playerWithPhraseId, phraseText);
  const roomWithNewFakePhrase = produce(room, (draft) => {
    draft.currentRound.fakePhrases.push(fakePhrase),
      (draft.players.find((p) => p.id === playerWithPhraseId)!.status = 'finished_making_fake_phrase');
  });
  roomWithNewFakePhrase.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_MAKING_FAKE_PHRASE', { playerId: playerWithPhraseId });
  });

  const roundOriginalPhrase = roomWithNewFakePhrase.originalPhrases.find(
    (p) => p.id === roomWithNewFakePhrase.currentRound.originalPhraseId
  )!;
  const everyoneDone = roomWithNewFakePhrase.players
    .filter((player) => player.id !== room.currentRound.roundPlayerId)
    .filter((player) => player.id !== roundOriginalPhrase.authorId)
    .every((player) => player.status === 'finished_making_fake_phrase');
  if (everyoneDone) {
    const roomVoting = startVoting(roomWithNewFakePhrase);
    return roomVoting;
  } else {
    return roomWithNewFakePhrase;
  }
}

function startVoting(room: GameRoomMakingFakePhrases): GameRoomVoting {
  const currentOriginalPhrase = room.originalPhrases.find((p) => p.id === room.currentRound.originalPhraseId)!;
  const roomVoting: GameRoomVoting = { ...room, state: 'VOTING' };
  const roomWithPlayersUpdated = produce(roomVoting, (draft) => {
    draft.players.forEach((player) => {
      player.status = 'voting';
    });
  });
  roomWithPlayersUpdated.players.forEach((player) => {
    // TODO: Maybe a better way is to send phrases with some kind of IDs.
    const phrases = [...roomVoting.currentRound.fakePhrases, currentOriginalPhrase];
    const phrasesDto = phrases.map((phrase) => phraseToDto(phrase));
    player.socket.emit('START_VOTING', { phrases: phrasesDto });
  });
  return roomWithPlayersUpdated;
}

export function playerVotedForPhrase(
  room: GameRoomVoting,
  votedPlayerId: number,
  phraseId: number
): GameRoomVoting | GameRoomShowingVotingResults {
  const roomWithNewVote = produce(room, (draft) => {
    draft.players.find((p) => p.id === votedPlayerId)!.status = 'finished_voting';
    draft.currentRound.votes.push({ playerId: votedPlayerId, phraseId: phraseId });
  });

  room.players.forEach((player) => {
    player.socket.emit('PLAYER_FINISHED_VOTING', { playerId: votedPlayerId });
  });

  // Check if everyone voted.
  // If a player is an author of the original phrase or a drawing author they don't vote.
  const currentOriginalPhrase = roomWithNewVote.originalPhrases.find(
    (p) => p.id === roomWithNewVote.currentRound.originalPhraseId
  )!;
  const playersToVote = roomWithNewVote.players.filter(
    (player) => player.id !== currentOriginalPhrase.authorId && player.id !== roomWithNewVote.currentRound.roundPlayerId
  );
  const everyoneVoted = playersToVote.every((player) => player.status === 'finished_voting');
  if (everyoneVoted) {
    const roomWithUpdatedPoints = updatePointsOnRoundEnd(roomWithNewVote);
    const roomShowingResults = showVotingResults(roomWithUpdatedPoints);
    return roomShowingResults;
  } else {
    return roomWithNewVote;
  }
}

function updatePointsOnRoundEnd(room: GameRoomVoting): GameRoomVoting {
  const currentOriginalPhrase = room.originalPhrases.find((p) => p.id === room.currentRound.originalPhraseId)!;
  const currentAllPhrases = [currentOriginalPhrase, ...room.currentRound.fakePhrases];
  const roomWithUpdatedPoints = produce(room, (draft) => {
    draft.currentRound.votes.forEach((vote) => {
      if (vote.phraseId === draft.currentRound.originalPhraseId) {
        const voter = draft.players.find((p) => p.id === vote.playerId)!;
        voter.points += 1;
        // If a vote is for the original phase, award a point to the drawing author rather than the phrase author.
        const currentRoundPlayer = draft.players.find((p) => p.id === room.currentRound.roundPlayerId)!;
        currentRoundPlayer.points += 1;
      } else {
        const votedPhrase = currentAllPhrases.find((p) => p.id === vote.phraseId)!;
        const votedPhraseAuthor = draft.players.find((player) => player.id === votedPhrase.authorId)!;
        votedPhraseAuthor.points += 1;
      }
    });
  });

  roomWithUpdatedPoints.players.forEach((player) => {
    player.socket.emit('UPDATE_POINTS', {
      points: room.players.map((player) => ({
        playerId: player.id,
        points: player.points,
      })),
    });
  });

  return roomWithUpdatedPoints;
}

function showVotingResults(room: GameRoomVoting): GameRoomShowingVotingResults {
  const roomShowingResults: GameRoomShowingVotingResults = { ...room, state: 'SHOWING_VOTING_RESULTS' };

  const currentOriginalPhrase = roomShowingResults.originalPhrases.find(
    (p) => p.id === roomShowingResults.currentRound.originalPhraseId
  )!;
  roomShowingResults.players.forEach((player) => {
    player.socket.emit('SHOW_VOTING_RESULTS', {
      votes: roomShowingResults.currentRound.votes.map((vote) => voteToDto(vote)),
      originalPhrase: phraseToDto(currentOriginalPhrase),
    });
  });

  return roomShowingResults;
}

export function selectNextRoundPlayer(room: GameRoomDrawing | GameRoomShowingVotingResults): Player | null {
  const playersIds = room.players.map((player) => player.id);
  const availablePlayersIds =
    room.state == 'DRAWING' ? playersIds : playersIds.filter((id) => !room.finishedRoundsPlayersIds.includes(id));
  if (availablePlayersIds.length === 0) {
    return null;
  }
  const nextRoundPlayerId = selectRandomElement(availablePlayersIds);
  const nextRoundPlayer = room.players.find((p) => p.id === nextRoundPlayerId) ?? null;
  return nextRoundPlayer;
}
