import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import {
  addPlayer,
  createRoom,
  DEFAULT_HOST_ID,
  GameRoom,
  nextPlayerId,
  playerFinishedDrawing,
  playerFinishedFakePhrase,
  playerVotedForPhrase,
  startDrawing,
} from './domain/GameRoom';
import { createPlayer } from './domain/Player';
import DrawingDto, { drawingFromDto } from './dto/DrawingDto';

const phrases = fs.readFileSync(path.join(__dirname, '../static/phrases.txt'), { encoding: 'utf8' }).split('\n');

const rooms: GameRoom[] = [];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
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
    const room = rooms.find((room) => room.players.some((player) => player.socket.id === socket.id));
    if (!room) {
      return;
    }
    const player = room.players.find((player) => player.socket.id === socket.id);
    if (!player) {
      return;
    }
    if (room.hostId !== player.id) {
      return;
    }

    startDrawing(room);
  });

  socket.on('DRAWING_DONE', ({ drawing: drawingDto }: { drawing: DrawingDto }) => {
    const room = rooms.find((room) => room.players.some((player) => player.socket.id === socket.id));
    if (!room) {
      return;
    }
    const drawingPlayer = room.players.find((player) => player.socket.id === socket.id);
    if (!drawingPlayer) {
      return;
    }

    const drawing = drawingFromDto(drawingDto);
    playerFinishedDrawing(room, drawingPlayer, drawing);
  });

  socket.on('FAKE_PHRASE_DONE', ({ text }: { text: string }) => {
    const room = rooms.find((room) => room.players.some((player) => player.socket.id === socket.id));
    if (!room) {
      return;
    }
    const playerWithPhrase = room.players.find((player) => player.socket.id === socket.id);
    if (!playerWithPhrase) {
      return;
    }

    playerFinishedFakePhrase(room, playerWithPhrase, text);
  });

  socket.on('VOTE_FOR_PHRASE', ({ phrase }: { phrase: string }) => {
    const room = rooms.find((room) => room.players.some((player) => player.socket.id === socket.id));
    if (!room) {
      return;
    }
    const socketPlayer = room.players.find((player) => player.socket.id === socket.id);
    if (!socketPlayer) {
      return;
    }

    playerVotedForPhrase(room, socketPlayer, phrase);
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
