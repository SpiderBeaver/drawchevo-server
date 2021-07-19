import http from 'http';
import { Server } from 'socket.io';
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
import DrawingDto, { drawingFromDto } from './dto/DrawingDto';

const MINIMUM_PLAYERS_COUNT = 4;

export function initializeSocket(httpServer: http.Server, rooms: GameRoom[]) {
  const ioServer = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  setupListeners(ioServer, rooms);
}

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
      const roomId = Math.random().toString(36).substr(2, 9);
      socket.join(`gameroom:${roomId}`);

      const player = createPlayer(DEFAULT_HOST_ID, username, socket);
      const room = createRoom(player);
      rooms.push(room);
    });

    socket.on('JOIN_ROOM', ({ roomId, username }: { roomId: string; username: string }) => {
      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex !== -1) {
        const room = rooms[roomIndex];
        socket.join(`gameroom:${roomId}`);

        // Maybe should incapsulate this logic. But it works for now.
        const newPlayerId = nextPlayerId(room);
        const newPlayer = createPlayer(newPlayerId, username, socket);
        const roomUpdated = addPlayer(room, newPlayer);
        rooms[rooms.indexOf(room)] = roomUpdated;
      }
    });

    socket.on('RECONNECT', ({ playerToken }: { playerToken: string }) => {
      const [player, room] = findPlayerByToken(rooms, playerToken);
      if (player && room) {
        player.socket = socket;
        socket.emit('ASSING_PLAYER_ID', { playerId: player.id });
        const roomDto = gameRoomToDto(room, player.id);
        socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
      }
    });

    socket.on('QUIT_GAME', () => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      // For now just end the game if someone leaves.
      // TODO: Think about allowing players to continue.
      room.players.forEach((player) => player.socket.emit('GAME_ENDED'));
      rooms = rooms.filter((r) => r !== room);
    });

    socket.on('START_GAME', () => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      if (room.hostId !== socketPlayer.id) {
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
    });

    socket.on('PHRASE_DONE', ({ phrase }: { phrase: string }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }
      if (room.state !== 'MAKING_PHRASES') {
        return;
      }

      const roomUpdated = playerFinishedPhrase(room, socketPlayer.id, phrase);
      rooms[rooms.indexOf(room)] = roomUpdated;
    });

    socket.on('DRAWING_DONE', ({ drawing: drawingDto }: { drawing: DrawingDto }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }
      if (room.state !== 'DRAWING') {
        return;
      }

      const drawing = drawingFromDto(drawingDto);
      const roomUpdated = playerFinishedDrawing(room, socketPlayer.id, drawing);
      rooms[rooms.indexOf(room)] = roomUpdated;
    });

    socket.on('FAKE_PHRASE_DONE', ({ text }: { text: string }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }
      if (room.state !== 'MAKING_FAKE_PHRASES') {
        return;
      }

      const roomUpdated = playerFinishedFakePhrase(room, socketPlayer.id, text);
      rooms[rooms.indexOf(room)] = roomUpdated;
    });

    socket.on('VOTE_FOR_PHRASE', ({ phrasePlayerId }: { phrasePlayerId: number }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }
      if (room.state !== 'VOTING') {
        return;
      }

      const roomUpdated = playerVotedForPhrase(room, socketPlayer.id, phrasePlayerId);
      rooms[rooms.indexOf(room)] = roomUpdated;
    });

    socket.on('START_NEXT_ROUND', () => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      if (room.hostId !== socketPlayer.id) {
        return;
      }
      if (room.state !== 'SHOWING_VOTING_RESULTS') {
        return;
      }

      const roomUpdated = startNextRound(room);
      rooms[rooms.indexOf(room)] = roomUpdated;
    });
  });
}

function findPlayerBySocket(rooms: GameRoom[], socketId: string): [Player | undefined, GameRoom | undefined] {
  const room = rooms.find((room) => room.players.some((player) => player.socket.id === socketId));
  const player = room?.players.find((player) => player.socket.id === socketId);
  return [player, room];
}

function findPlayerByToken(rooms: GameRoom[], token: string): [Player | undefined, GameRoom | undefined] {
  const room = rooms.find((room) => room.players.some((player) => player.token === token));
  const player = room?.players.find((player) => player.token === token);
  return [player, room];
}
