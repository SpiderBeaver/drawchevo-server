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
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
