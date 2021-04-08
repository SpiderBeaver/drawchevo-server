import { Player, PlayerStatus } from '../domain/Player';

export interface PlayerDto {
  id: number;
  username: string;
  status: PlayerStatus;
}

export function playerToDto(player: Player): PlayerDto {
  return { id: player.id, username: player.username, status: player.status };
}
