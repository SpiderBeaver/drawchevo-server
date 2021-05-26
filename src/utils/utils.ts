export function selectRandomElement<T>(array: T[]) {
  const randomElement = array[Math.floor(Math.random() * array.length)];
  return randomElement;
}

/**
 * Note: This method is slow and not truly random. Don't use it for cryptography or big collections.
 * @param array
 * @returns
 */
export function shuffle<T>(array: T[]) {
  const newArray = [...array];
  newArray.sort(() => Math.random() - 0.5);
  return newArray;
}
