export function selectRandomElement<T>(array: T[]) {
  const randomElement = array[Math.floor(Math.random() * array.length)];
  return randomElement;
}
