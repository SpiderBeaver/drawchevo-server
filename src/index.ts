import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameRoom, gameRoomToDto, selectNextRoundPlayer, selectPhrases } from './domain/GameRoom';
import { PlayerDto, playerToDto } from './dto/PlayerDto';
import DrawingDto, { drawingFromDto, drawingToDto } from './dto/DrawingDto';
import { Player } from './domain/Player';

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

    const playerId = 0;
    const room: GameRoom = {
      id: roomId,
      hostId: playerId,
      state: 'NOT_STARTED',
      players: [{ id: playerId, socket: socket, username: username, status: 'idle' }],
      originalPhrases: [],
      drawings: [],
      fakePhrases: [],
      currentRoundPlayerId: null,
      finishedRoundsPlayersIds: [],
    };
    rooms.push(room);

    const roomDto = gameRoomToDto(room, playerId);
    socket.emit('ASSING_PLAYER_ID', { playerId: playerId });
    socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });

  socket.on('JOIN_ROOM', ({ roomId, username }: { roomId: string; username: string }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      socket.join(`gameroom:${roomId}`);

      // Maybe should incapsulate this logic. But it works for now.
      const newPlayerId = Math.max(...room.players.map((p) => p.id)) + 1;
      const newPlayer: Player = { id: newPlayerId, socket: socket, username: username, status: 'idle' };
      room.players.push(newPlayer);

      const roomDto = gameRoomToDto(room, newPlayerId);
      socket.emit('ASSING_PLAYER_ID', { playerId: newPlayerId });
      socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
      const playerDto = playerToDto(newPlayer);
      // TODO: Think about from moving away from socket room and just do broadcasting manually.
      // So we don't have to mantain the consistency between game rooms and socket.io rooms.
      socket.to(`gameroom:${roomId}`).emit('PLAYER_JOINED', { player: playerDto });
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

    room.state = 'DRAWING';
    room.originalPhrases = selectPhrases(
      room.players.map((p) => p.id),
      phrases
    );
    room.players.forEach((player) => (player.status = 'drawing'));
    // NOTE: It's probably better to send just the phrases. But we can simply refresh the fame state as well.
    // NOTE: We don't want to send all the phrases to all the players. Just send the ones they need to draw.
    room.players.forEach((player) => {
      const roomDto = gameRoomToDto(room, player.id);
      player.socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
    });
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

    drawingPlayer.status = 'finished_drawing';
    room.drawings.push({ playerId: drawingPlayer.id, drawing: drawingFromDto(drawingDto) });
    room.players.forEach((player) => {
      player.socket.emit('PLAYER_FINISHED_DRAWING', { playerId: drawingPlayer.id });
    });

    const everyoneFinishedDrawing = room.players.every((player) => player.status === 'finished_drawing');
    if (everyoneFinishedDrawing) {
      const nextRoundPlayerId = selectNextRoundPlayer(room);
      if (nextRoundPlayerId !== null) {
        room.state = 'MAKING_FAKE_PHRASES';
        room.currentRoundPlayerId = nextRoundPlayerId;
        const currentRoundDrawing = room.drawings.find((d) => d.playerId === nextRoundPlayerId)?.drawing;
        if (currentRoundDrawing) {
          const currentRoundDrawingDto = drawingToDto(currentRoundDrawing);
          room.players.forEach((player) => {
            player.socket.emit('START_MAKING_FAKE_PHRASES', { drawing: currentRoundDrawingDto });
          });
        }
      }
    }
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
