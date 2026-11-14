// Explicit challenge-generation requests change the Practice workspace rather
// than returning an inert list of exercises in chat. Ordinary questions remain
// conversational. The visible "Generate challenges" action is the unambiguous path.
export function requestsNewChallenges(message: string): boolean {
  const q = message.trim().toLowerCase();
  if (/^\/(?:challenges|new-challenges)(?:\s|$)/.test(q)) return true;
  if (/\b(?:explain|describe|what is|what are|hint about|review|understand)\b/.test(q) && !/\b(?:give|generate|create|make)\b/.test(q)) return false;
  if (/\b(?:another|new|more|next|fresh|additional)\s+(?:(?:set|batch|series)\s+of\s+)?(?:(?:coding|practice|similar)\s+)?(?:challenges?|exercises?|problems?)\b/.test(q)) return true;
  if (/\b(?:give|generate|create|make|show|prepare)\b.{0,70}\b(?:set|batch|series)\s+of\s+(?:(?:coding|practice)\s+)?(?:challenges?|exercises?|problems?)\b/.test(q)) return true;
  return false;
}
