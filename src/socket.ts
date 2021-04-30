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
} from './domain/GameRoom';
import { createPlayer, Player } from './domain/Player';
import DrawingDto, { drawingFromDto } from './dto/DrawingDto';
import { usePhrasesCollection } from './phrasesCollection';

export function initializeSocket(httpServer: http.Server, rooms: GameRoom[]) {
  const ioServer = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  setupListeners(ioServer, rooms);
}

function setupListeners(ioServer: Server, rooms: GameRoom[]) {
  const phrases = usePhrasesCollection();

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
      const room = createRoom(player, phrases);
      rooms.push(room);
    });

    socket.on('JOIN_ROOM', ({ roomId, username }: { roomId: string; username: string }) => {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        socket.join(`gameroom:${roomId}`);

        // Maybe should incapsulate this logic. But it works for now.
        const newPlayerId = nextPlayerId(room);
        const newPlayer = createPlayer(newPlayerId, username, socket);
        addPlayer(room, newPlayer);
      }
    });

    socket.on('START_GAME', () => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      if (room.hostId !== socketPlayer.id) {
        return;
      }

      startDrawing(room);
    });

    socket.on('DRAWING_DONE', ({ drawing: drawingDto }: { drawing: DrawingDto }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      const drawing = drawingFromDto(drawingDto);
      playerFinishedDrawing(room, socketPlayer, drawing);
    });

    socket.on('FAKE_PHRASE_DONE', ({ text }: { text: string }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      playerFinishedFakePhrase(room, socketPlayer, text);
    });

    socket.on('VOTE_FOR_PHRASE', ({ phrasePlayerId }: { phrasePlayerId: number }) => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      playerVotedForPhrase(room, socketPlayer, phrasePlayerId);
    });

    socket.on('START_NEXT_ROUND', () => {
      const [socketPlayer, room] = findPlayerBySocket(rooms, socket.id);
      if (!socketPlayer || !room) {
        return;
      }

      if (room.hostId !== socketPlayer.id) {
        return;
      }

      startNextRound(room);
    });
  });
}

function findPlayerBySocket(rooms: GameRoom[], socketId: string): [Player | undefined, GameRoom | undefined] {
  const room = rooms.find((room) => room.players.some((player) => player.socket.id === socketId));
  const player = room?.players.find((player) => player.socket.id === socketId);
  return [player, room];
}
