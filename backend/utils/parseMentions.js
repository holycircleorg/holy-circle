export function extractMentions(text) {
  if (!text) return [];

  // Matches @username (letters, numbers, underscores)
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];

  return [...new Set(matches.map(m => m.substring(1)))];
}
