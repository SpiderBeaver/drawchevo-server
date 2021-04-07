import { createServer } from 'http';
import { Server } from 'socket.io';

interface GameRoom {
  id: string;
  players: string[];
}

const rooms: GameRoom[] = [];

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  console.log('New connection');

  socket.on('message', (args) => {
    console.log(args);
  });

  socket.on('CREATE_ROOM', () => {
    const roomId = Math.random().toString(36).substr(2, 9);
    socket.join(`gameroom:${roomId}`);

    const room: GameRoom = {
      id: roomId,
      players: [socket.id],
    };
    rooms.push(room);

    socket.emit('UPDATE_ROOM_STATE', { room: room });
  });

  socket.on('JOIN_ROOM', ({ roomId }: { roomId: string }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      socket.join(`gameroom:${roomId}`);

      room.players.push(socket.id);
      socket.emit('UPDATE_ROOM_STATE', { room: room });
      socket.to(`gameroom:${roomId}`).emit('PLAYER_JOINED', { playerId: socket.id });
    }
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
