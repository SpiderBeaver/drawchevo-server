import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameRoomDto } from './dto/GameRoomDto';
import { PlayerDto } from './dto/PlayerDto';

interface Player {
  id: number;
  socketId: string;
}

interface GameRoom {
  id: string;
  hostId: number;
  players: Player[];
}

function gameRoomToDto(room: GameRoom): GameRoomDto {
  const dto: GameRoomDto = {
    id: room.id,
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
    })),
  };
  return dto;
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

    const playerId = 0;
    const room: GameRoom = {
      id: roomId,
      hostId: playerId,
      players: [{ id: playerId, socketId: socket.id }],
    };
    rooms.push(room);

    const roomDto = gameRoomToDto(room);
    socket.emit('ASSING_PLAYER_ID', { playerId: playerId });
    socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
  });

  socket.on('JOIN_ROOM', ({ roomId }: { roomId: string }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      socket.join(`gameroom:${roomId}`);

      // Maybe should incapsulate this logic. But it works for now.
      const newPlayerId = Math.max(...room.players.map((p) => p.id)) + 1;
      room.players.push({ id: newPlayerId, socketId: socket.id });

      const roomDto = gameRoomToDto(room);
      socket.emit('ASSING_PLAYER_ID', { playerId: newPlayerId });
      socket.emit('UPDATE_ROOM_STATE', { room: roomDto });
      const playerDto: PlayerDto = { id: newPlayerId };
      socket.to(`gameroom:${roomId}`).emit('PLAYER_JOINED', { player: playerDto });
    }
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
function PlayerDto(arg0: (player: Player) => void, as: any, PlayerDto: any): import('./dto/PlayerDto').PlayerDto[] {
  throw new Error('Function not implemented.');
}
