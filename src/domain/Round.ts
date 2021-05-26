import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Player } from './Player';
import { Vote } from './Vote';

export interface Round {
  roundPlayer: Player;
  originalPhrase: Phrase;
  drawing: Drawing;
  fakePhrases: Phrase[];
  votes: Vote[];
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

export function getPhraseByAuthorId(round: Round, playerId: number) {
  const allPhrases = [round.originalPhrase, ...round.fakePhrases];
  const phrase = allPhrases.find((p) => p.authorId === playerId);
  return phrase;
}
