import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';

export interface Round {
  roundPlayer: Player;
  originalPhrase: Phrase;
  drawing: Drawing;
  fakePhrases: Phrase[];
  votes: { playerId: number; phrase: Phrase }[];
}

export function newRound(roundPlayer: Player, originalPhrase: Phrase, drawing: Drawing): Round {
  const round: Round = {
    roundPlayer: roundPlayer,
    originalPhrase: originalPhrase,
    drawing: drawing,
    fakePhrases: [],
    votes: [],
  };
  return round;
}

export function getPhraseByText(round: Round, phraseText: string) {
  const allPhrases = [round.originalPhrase, ...round.fakePhrases];
  const phrase = allPhrases.find((p) => p.text === phraseText);
  return phrase;
}
