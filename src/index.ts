import { createServer } from 'http';
import { GameRoom } from './domain/GameRoom';
import { initializeSocket } from './socket';

const rooms: GameRoom[] = [];

const httpServer = createServer();
initializeSocket(httpServer, rooms);

const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
