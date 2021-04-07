import { createServer } from 'http';
import { Server } from 'socket.io';

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
    socket.emit('CREATED_ROOM', { roomId: roomId });
  });

  socket.on('JOIN_ROOM', ({ roomId }: { roomId: string }) => {
    const roomIdFull = `gameroom:${roomId}`;
    if (io.sockets.adapter.rooms.has(roomIdFull)) {
      socket.join(roomIdFull);
      socket.emit('JOINED_ROOM', { roomId: roomId });
    }
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
