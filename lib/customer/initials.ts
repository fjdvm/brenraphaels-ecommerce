/** Up to two capital letters from a name, for avatar badges. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join("").toUpperCase();
}
