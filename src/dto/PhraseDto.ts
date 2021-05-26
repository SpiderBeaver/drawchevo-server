import { Phrase } from '../domain/Phrase';

export interface PhraseDto {
  authorId: number;
  drawingPlayerId: number | null;
  text: string;
}

export function phraseToDto(phrase: Phrase): PhraseDto {
  const dto: PhraseDto = {
    authorId: phrase.authorId,
    drawingPlayerId: phrase.drawingPlayerId,
    text: phrase.text,
  };
  return dto;
}
