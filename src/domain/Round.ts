import Drawing from './Drawing';
import { Phrase } from './Phrase';
import { Vote } from './Vote';

export interface Round {
  roundPlayerId: number;
  originalPhraseId: number;
  drawing: Drawing;
  fakePhrases: Phrase[];
  votes: Vote[];
}

export function newRound(roundPlayerId: number, originalPhraseId: number, drawing: Drawing): Round {
  const round: Round = {
    roundPlayerId: roundPlayerId,
    originalPhraseId: originalPhraseId,
    drawing: drawing,
    fakePhrases: [],
    votes: [],
  };
  return round;
}
