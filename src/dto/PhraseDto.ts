import { Phrase } from '../domain/Phrase';

export interface PhraseDto {
  playerId: number;
  text: string;
}

export function phraseToDto(phrase: Phrase): PhraseDto {
  const dto: PhraseDto = {
    playerId: phrase.playerId,
    text: phrase.text,
  };
  return dto;
}
