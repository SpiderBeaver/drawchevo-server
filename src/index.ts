import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameRoom, gameRoomToDto } from './domain/GameRoom';
import { PlayerDto } from './dto/PlayerDto';

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
      players: [{ id: playerId, socketId: socket.id, username: username }],
    };
    rooms.push(room);

    const roomDto = gameRoomToDto(room);
    socket.emit('ASSING_PLAYER_ID', { playerId: playerId });
    socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });

  socket.on('JOIN_ROOM', ({ roomId, username }: { roomId: string; username: string }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      socket.join(`gameroom:${roomId}`);

      // Maybe should incapsulate this logic. But it works for now.
      const newPlayerId = Math.max(...room.players.map((p) => p.id)) + 1;
      room.players.push({ id: newPlayerId, socketId: socket.id, username: username });

      const roomDto = gameRoomToDto(room);
      socket.emit('ASSING_PLAYER_ID', { playerId: newPlayerId });
      socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
      const playerDto: PlayerDto = { id: newPlayerId, username: username };
      socket.to(`gameroom:${roomId}`).emit('PLAYER_JOINED', { player: playerDto });
    }
  });

  socket.on('START_GAME', () => {
    const room = rooms.find((room) => room.players.some((player) => player.socketId === socket.id));
    if (!room) {
      return;
    }
    const player = room.players.find((player) => player.socketId === socket.id);
    if (!player) {
      return;
    }

    if (room.hostId !== player.id) {
      return;
    }

    room.state = 'STARTED';
    io.to(`gameroom:${room.id}`).emit('STARTED_GAME');
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
