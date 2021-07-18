import { Phrase } from '../domain/Phrase';

export interface PhraseDto {
  authorId: number;
  text: string;
}

export function phraseToDto(phrase: Phrase): PhraseDto {
  const dto: PhraseDto = {
    authorId: phrase.authorId,
    text: phrase.text,
  };
  return dto;
}
