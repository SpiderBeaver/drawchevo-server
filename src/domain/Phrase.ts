let idCounter = -1;

export interface Phrase {
  id: number;
  authorId: number;
  text: string;
}

export function createPhrase(authorId: number, text: string) {
  idCounter += 1;
  const phrase: Phrase = { id: idCounter, authorId: authorId, text: text };
  return phrase;
}
