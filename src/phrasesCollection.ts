import fs from 'fs';
import path from 'path';

const phrases = fs.readFileSync(path.join(__dirname, '../static/phrases.txt'), { encoding: 'utf8' }).split('\n');

export function usePhrasesCollection() {
  return phrases;
}
