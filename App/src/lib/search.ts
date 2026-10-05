import { SavedItem } from '../types';

/**
 * Search across title, creator, tags, AI keywords, notes and summaries.
 * Includes a lightweight "semantic" layer (synonym/intent expansion) to
 * simulate PRD §11.2 natural-language search ("places I wanted to visit").
 */

const INTENTS: Array<{ match: RegExp; expands: string[] }> = [
  { match: /place|visit|trip|travel|tourism|itinerar/i, expands: ['hyderabad', 'charminar', 'travel', 'tourism', 'places', 'itinerary', 'weekend', 'trip'] },
  { match: /eat|food|restaurant|cafe|biryani|street food|dinner|lunch/i, expands: ['food', 'biryani', 'cafe', 'restaurant', 'recipe', 'cooking'] },
  { match: /code|react|program|dev|javascript|python|typescript/i, expands: ['react', 'programming', 'coding', 'javascript', 'python', 'typescript', 'developer', 'tutorial'] },
  { match: /gym|fitness|workout|exercise/i, expands: ['fitness', 'gym', 'workout', 'health'] },
  { match: /buy|shop|product|price/i, expands: ['buy-later', 'shopping', 'product', 'deal'] },
  { match: /learn|study|course|tutorial|college|exam/i, expands: ['education', 'tutorial', 'study', 'course', 'college'] },
  { match: /money|finance|invest|stock|budget/i, expands: ['finance', 'investing', 'stocks', 'money'] },
];

export function expandQuery(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/[\s"']+/)
    .filter((t) => t.length > 1);
  const expanded = new Set(terms);
  for (const intent of INTENTS) {
    if (intent.match.test(query)) intent.expands.forEach((t) => expanded.add(t));
  }
  return [...expanded];
}

export interface MatchResult {
  item: SavedItem;
  score: number;
  matchedIn: string[]; // field names that matched, for "Why these results"
}

export function searchItems(items: SavedItem[], query: string): MatchResult[] {
  const terms = expandQuery(query);
  if (terms.length === 0) return [];

  const results: MatchResult[] = [];
  for (const item of items) {
    if (item.isArchived) continue;
    const fields: Record<string, string> = {
      title: item.title.toLowerCase(),
      creator: `${item.creatorName} ${item.creatorHandle ?? ''}`.toLowerCase(),
      tags: item.tags.map((t) => t.toLowerCase()).join(' '),
      keywords: item.aiKeywords.map((k) => k.toLowerCase()).join(' '),
      summary: (item.aiSummary ?? '').toLowerCase(),
      note: `${item.note ?? ''} ${item.whySaved ?? ''}`.toLowerCase(),
      category: (item.aiCategory ?? '').toLowerCase(),
    };
    let score = 0;
    const matchedIn = new Set<string>();
    for (const term of terms) {
      for (const [field, text] of Object.entries(fields)) {
        if (!text) continue;
        if (text.includes(term)) {
          score += field === 'title' ? 5 : field === 'tags' ? 3 : field === 'keywords' ? 2 : 1;
          matchedIn.add(field);
        }
      }
    }
    if (score > 0) {
      // Recency tiebreaker (PRD §11.3)
      score += Math.max(0, 2 - (Date.now() - item.savedAt) / (1000 * 60 * 60 * 24 * 90));
      results.push({ item, score, matchedIn: [...matchedIn] });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}
