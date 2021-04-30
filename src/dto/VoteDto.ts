import { Vote } from '../domain/Vote';
import { PhraseDto, phraseToDto } from './PhraseDto';

export interface VoteDto {
  playerId: number;
  phrase: PhraseDto;
}

export function voteToDto(vote: Vote): VoteDto {
  const dto: VoteDto = {
    playerId: vote.playerId,
    phrase: phraseToDto(vote.phrase),
  };
  return dto;
}
