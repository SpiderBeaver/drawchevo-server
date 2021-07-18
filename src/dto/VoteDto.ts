import { Vote } from '../domain/Vote';

export interface VoteDto {
  playerId: number;
  phraseId: number;
}

export function voteToDto(vote: Vote): VoteDto {
  const dto: VoteDto = {
    playerId: vote.playerId,
    phraseId: vote.phraseId,
  };
  return dto;
}
