import { SavedItem } from '../types';

/**
 * Phase-1 AI pipeline (PRD §19-20), mocked locally:
 * async keyword extraction, category suggestion and summary.
 * In production this calls a Supabase Edge Function backed by an LLM.
 */

const CATEGORY_RULES: Array<{ category: string; words: RegExp }> = [
  { category: 'Travel', words: /travel|place|city|hotel|trip|tour|charminar|golconda|visit/i },
  { category: 'Food', words: /food|recipe|biryani|cafe|cook|restaurant|eat/i },
  { category: 'Programming', words: /react|code|javascript|python|typescript|program|dev|api/i },
  { category: 'Technology', words: /tech|ai|gadget|phone|laptop|software/i },
  { category: 'Fitness', words: /gym|workout|fitness|health|exercise|diet/i },
  { category: 'Finance', words: /invest|stock|money|finance|budget|crypto/i },
  { category: 'Education', words: /learn|tutorial|course|study|exam|college/i },
  { category: 'Shopping', words: /buy|deal|shop|product|price|amazon/i },
  { category: 'Entertainment', words: /funny|movie|music|comedy|meme/i },
  { category: 'Inspiration', words: /inspire|motivat|idea|design|aesthetic/i },
];

const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'you', 'your', 'how', 'why', 'what', 'best', 'top', 'new', 'from', 'into', 'about']);

export function suggestCategory(text: string): string {
  for (const rule of CATEGORY_RULES) if (rule.words.test(text)) return rule.category;
  return 'Other';
}

export function extractKeywords(text: string, max = 6): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w[0].toUpperCase() + w.slice(1));
}

/** Compose a short deterministic summary from title + keywords (mock LLM). */
export function summarize(title: string, text: string): string {
  const cat = suggestCategory(`${title} ${text}`);
  const kw = extractKeywords(`${title} ${text}`, 3);
  const topic = kw.length ? kw.join(', ') : title;
  if (cat === 'Travel') return `Saves a travel idea about ${topic}. Useful for planning places to visit, food and itineraries.`;
  if (cat === 'Food') return `A food find featuring ${topic}. Worth revisiting when looking for restaurant or recipe ideas.`;
  if (cat === 'Programming') return `A developer resource covering ${topic}. Reference material for coding and project work.`;
  if (cat === 'Fitness') return `A fitness tip about ${topic}. Includes practical guidance for training routines.`;
  return `Saved content about ${topic}, categorized as ${cat}.`;
}

/**
 * Simulate the async AI pipeline: never blocks saving (PRD rule 2).
 * Returns the AI metadata after a short delay; failures never surface.
 */
export function runAiPipeline(item: SavedItem): Promise<{
  summary: string;
  keywords: string[];
  category: string;
  state: 'done' | 'failed';
}> {
  const text = `${item.title} ${item.note ?? ''}`;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        summary: summarize(item.title, text),
        keywords: extractKeywords(text),
        category: suggestCategory(text),
        state: 'done',
      });
    }, 2200);
  });
}
