// TODO: Fugure out the correct way to store data for original and fake phrases.
export interface Phrase {
  authorId: number;
  drawingPlayerId: number | null;
  text: string;
}
