import { Phrase } from '../domain/Phrase';

export interface PhraseDto {
  id: number;
  authorId: number;
  text: string;
}

export function phraseToDto(phrase: Phrase): PhraseDto {
  const dto: PhraseDto = {
    id: phrase.id,
    authorId: phrase.authorId,
    text: phrase.text,
  };
  return dto;
}
