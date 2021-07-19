import http from 'http';
import { Server, Socket } from 'socket.io';
import {
  DEFAULT_HOST_ID,
  createRoom,
  nextPlayerId,
  addPlayer,
  startDrawing,
  playerFinishedDrawing,
  playerFinishedFakePhrase,
  playerVotedForPhrase,
  startNextRound,
  GameRoom,
  gameRoomToDto,
  startMakingPhrases,
  playerFinishedPhrase,
} from './domain/GameRoom';
import { createPlayer, Player } from './domain/Player';
import DrawingDto, { drawingFromDto, drawingToDto } from './dto/DrawingDto';
import { phraseToDto } from './dto/PhraseDto';
import { playerToDto } from './dto/PlayerDto';
import { voteToDto } from './dto/VoteDto';

const MINIMUM_PLAYERS_COUNT = 4;

export function initializeSocket(httpServer: http.Server, rooms: GameRoom[]) {
  const ioServer = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  setupListeners(ioServer, rooms);
}

interface PlayerSocket {
  socket: Socket;
  roomId: string;
  playerId: number;
}
const playerSockets: PlayerSocket[] = [];

function setupListeners(ioServer: Server, rooms: GameRoom[]) {
  ioServer.on('connection', (socket) => {
    console.log(`New connection ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
    });

    socket.on('message', (args) => {
      console.log(args);
    });

    socket.on('CREATE_ROOM', ({ username }: { username: string }) => {
      const player = createPlayer(DEFAULT_HOST_ID, username);
      socket.emit('ASSING_PLAYER_ID', { playerId: player.id });
      socket.emit('ASSIGN_PLAYER_TOKEN', { token: player.token });
      const room = createRoom(player);
      socket.emit('UPDATE_ROOM_STATE', { room: gameRoomToDto(room, player.id) });
      rooms.push(room);
      playerSockets.push({ socket: socket, playerId: player.id, roomId: room.id });
    });

    socket.on('JOIN_ROOM', ({ roomId, username }: { roomId: string; username: string }) => {
      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex !== -1) {
        const room = rooms[roomIndex];
        // Maybe should incapsulate this logic. But it works for now.
        const newPlayerId = nextPlayerId(room);
        const newPlayer = createPlayer(newPlayerId, username);
        socket.emit('ASSING_PLAYER_ID', { playerId: newPlayer.id });
        socket.emit('ASSIGN_PLAYER_TOKEN', { token: newPlayer.token });
        const roomUpdated = addPlayer(room, newPlayer);
        rooms[rooms.indexOf(room)] = roomUpdated;
        socket.emit('UPDATE_ROOM_STATE', { room: gameRoomToDto(roomUpdated, newPlayer.id) });
        playerSockets.push({ socket: socket, playerId: newPlayer.id, roomId: room.id });

        const newPlayerDto = playerToDto(newPlayer);
        roomUpdated.players
          .filter((player) => player.id != newPlayer.id)
          .forEach((player) => {
            const playerSocket = playerSockets.find((ps) => ps.roomId === roomUpdated.id && ps.playerId === player.id)!;
            playerSocket.socket.emit('PLAYER_JOINED', { player: newPlayerDto });
          });
      }
    });

    socket.on('RECONNECT', ({ playerToken }: { playerToken: string }) => {
      const [player, room] = findPlayerByToken(rooms, playerToken);
      if (player && room) {
        const playerSocket = playerSockets.find((ps) => ps.roomId === room.id && ps.playerId === player.id)!;
        playerSocket.socket = socket;
        socket.emit('ASSING_PLAYER_ID', { playerId: player.id });
        const roomDto = gameRoomToDto(room, player.id);
        socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
      }
    });

    socket.on('QUIT_GAME', () => {
      // For now just end the game if someone leaves.
      // TODO: Think about allowing players to continue.
      const quitterPlayerSocket = playerSockets.find((ps) => ps.socket.id === socket.id)!;
      const room = rooms.find((r) => r.id === quitterPlayerSocket.roomId)!;
      broadcast(room, 'GAME_ENDED');
      rooms = rooms.filter((r) => r !== room);
    });

    socket.on('START_GAME', () => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }

      const room = rooms.find((r) => r.id === playerSocket.roomId)!;

      if (room.hostId !== playerSocket.playerId) {
        return;
      }
      if (room.players.length < MINIMUM_PLAYERS_COUNT) {
        return;
      }

      if (room.state !== 'NOT_STARTED') {
        return;
      }

      const roomUpdated = startMakingPhrases(room);
      rooms[rooms.indexOf(room)] = roomUpdated;

      broadcast(roomUpdated, 'START_MAKING_PHRASE');
    });

    socket.on('PHRASE_DONE', ({ phrase }: { phrase: string }) => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }
      const room = rooms.find((r) => r.id === playerSocket.roomId);
      if (!room) {
        return;
      }
      if (room.state !== 'MAKING_PHRASES') {
        return;
      }

      const roomUpdated = playerFinishedPhrase(room, playerSocket.playerId, phrase);
      rooms[rooms.indexOf(room)] = roomUpdated;

      broadcast(room, 'PLAYER_FINISHED_PHRASE', { playerId: playerSocket.playerId });
      if (roomUpdated.state === 'DRAWING') {
        // NOTE: It's probably better to send just the phrases. But we can simply refresh the whole state as well.
        // NOTE: We don't want to send all the phrases to all the players. Just send the ones they need to draw.
        roomUpdated.players.forEach((player) => {
          const roomDto = gameRoomToDto(roomUpdated, player.id);
          const playerSocketToEmit = playerSockets.find((ps) => ps.roomId === room.id && ps.playerId === player.id)!;
          playerSocketToEmit.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
        });
      }
    });

    socket.on('DRAWING_DONE', ({ drawing: drawingDto }: { drawing: DrawingDto }) => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }
      const room = rooms.find((r) => r.id === playerSocket.roomId);
      if (!room) {
        return;
      }
      if (room.state !== 'DRAWING') {
        return;
      }

      const drawing = drawingFromDto(drawingDto);
      const roomUpdated = playerFinishedDrawing(room, playerSocket.playerId, drawing);
      rooms[rooms.indexOf(room)] = roomUpdated;

      broadcast(room, 'PLAYER_FINISHED_DRAWING', { playerId: playerSocket.playerId });
      if (roomUpdated.state === 'MAKING_FAKE_PHRASES') {
        const currentRoundDrawingDto = drawingToDto(roomUpdated.currentRound.drawing);
        const currentRoundOriginalPhrase = room.originalPhrases.find(
          (p) => p.id === roomUpdated.currentRound.originalPhraseId
        )!;
        const currentRoundOriginalPhraseDro = phraseToDto(currentRoundOriginalPhrase);
        room.players.forEach((player) => {
          const playerSocketToEmit = playerSockets.find((ps) => ps.roomId === room.id && ps.playerId === player.id)!;
          playerSocketToEmit.socket.emit('START_MAKING_FAKE_PHRASES', {
            currentPlayerId: roomUpdated.currentRound.roundPlayerId,
            originalPhrase: currentRoundOriginalPhraseDro,
            drawing: currentRoundDrawingDto,
          });
        });
      }
    });

    socket.on('FAKE_PHRASE_DONE', ({ text }: { text: string }) => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }
      const room = rooms.find((r) => r.id === playerSocket.roomId);
      if (!room) {
        return;
      }
      if (room.state !== 'MAKING_FAKE_PHRASES') {
        return;
      }

      const roomUpdated = playerFinishedFakePhrase(room, playerSocket.playerId, text);
      rooms[rooms.indexOf(room)] = roomUpdated;

      broadcast(room, 'PLAYER_FINISHED_MAKING_FAKE_PHRASE', { playerId: playerSocket.playerId });
      if (roomUpdated.state === 'VOTING') {
        roomUpdated.players.forEach((player) => {
          // TODO: Maybe a better way is to send phrases with some kind of IDs.
          const currentOriginalPhrase = roomUpdated.originalPhrases.find(
            (p) => p.id === roomUpdated.currentRound.originalPhraseId
          )!;
          const phrases = [...roomUpdated.currentRound.fakePhrases, currentOriginalPhrase];
          const phrasesDto = phrases.map((phrase) => phraseToDto(phrase));
          const playerSocketToEmit = playerSockets.find(
            (ps) => ps.roomId === roomUpdated.id && ps.playerId === player.id
          )!;
          playerSocketToEmit.socket.emit('START_VOTING', { phrases: phrasesDto });
        });
      }
    });

    socket.on('VOTE_FOR_PHRASE', ({ phrasePlayerId }: { phrasePlayerId: number }) => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }
      const room = rooms.find((r) => r.id === playerSocket.roomId);
      if (!room) {
        return;
      }
      if (room.state !== 'VOTING') {
        return;
      }

      const roomUpdated = playerVotedForPhrase(room, playerSocket.playerId, phrasePlayerId);
      rooms[rooms.indexOf(room)] = roomUpdated;

      broadcast(room, 'PLAYER_FINISHED_VOTING', { playerId: playerSocket.playerId });
      if (roomUpdated.state === 'SHOWING_VOTING_RESULTS') {
        const currentOriginalPhrase = roomUpdated.originalPhrases.find(
          (p) => p.id === roomUpdated.currentRound.originalPhraseId
        )!;

        roomUpdated.players.forEach((player) => {
          const playerSocketToEmit = playerSockets.find(
            (ps) => ps.roomId === roomUpdated.id && ps.playerId === player.id
          )!;

          playerSocketToEmit.socket.emit('UPDATE_POINTS', {
            points: roomUpdated.players.map((player) => ({
              playerId: player.id,
              points: player.points,
            })),
          });

          playerSocketToEmit.socket.emit('SHOW_VOTING_RESULTS', {
            votes: roomUpdated.currentRound.votes.map((vote) => voteToDto(vote)),
            originalPhrase: phraseToDto(currentOriginalPhrase),
          });
        });
      }
    });

    socket.on('START_NEXT_ROUND', () => {
      const playerSocket = playerSockets.find((ps) => ps.socket.id === socket.id);
      if (!playerSocket) {
        return;
      }
      const room = rooms.find((r) => r.id === playerSocket.roomId);
      if (!room) {
        return;
      }

      if (room.hostId !== playerSocket.playerId) {
        return;
      }
      if (room.state !== 'SHOWING_VOTING_RESULTS') {
        return;
      }

      const roomUpdated = startNextRound(room);
      rooms[rooms.indexOf(room)] = roomUpdated;
      if (roomUpdated.state === 'MAKING_FAKE_PHRASES') {
        const currentRoundDrawingDto = drawingToDto(roomUpdated.currentRound.drawing);
        const currentRoundOriginalPhrase = room.originalPhrases.find(
          (p) => p.id === roomUpdated.currentRound.originalPhraseId
        )!;
        const currentRoundOriginalPhraseDro = phraseToDto(currentRoundOriginalPhrase);
        room.players.forEach((player) => {
          const playerSocketToEmit = playerSockets.find((ps) => ps.roomId === room.id && ps.playerId === player.id)!;
          playerSocketToEmit.socket.emit('START_MAKING_FAKE_PHRASES', {
            currentPlayerId: roomUpdated.currentRound.roundPlayerId,
            originalPhrase: currentRoundOriginalPhraseDro,
            drawing: currentRoundDrawingDto,
          });
        });
      }
    });
  });
}

function findPlayerByToken(rooms: GameRoom[], token: string): [Player | undefined, GameRoom | undefined] {
  const room = rooms.find((room) => room.players.some((player) => player.token === token));
  const player = room?.players.find((player) => player.token === token);
  return [player, room];
}

function broadcast(room: GameRoom, ev: string, args?: any) {
  room.players.forEach((player) => {
    const playerSocket = playerSockets.find((ps) => ps.roomId === room.id && ps.playerId === player.id)!;
    playerSocket.socket.emit(ev, args);
  });
}
