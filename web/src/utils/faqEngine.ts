import faqDataset from '../data/faq.json';

export interface RelatedAction {
  type: string;
  route: string;
  label: string;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  aliases?: string[];
  relatedActions?: RelatedAction[];
  relatedFaqIds?: string[];
}

export interface FaqMatchResult {
  matched: boolean;
  faqId?: string;
  category?: string;
  answer: string;
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
  score: number;
  relatedFaqIds?: string[];
  relatedActions?: RelatedAction[];
  suggestedQuestions?: string[];
}

export const FAQ_DATA: FaqItem[] = faqDataset as FaqItem[];

export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchFaq(query: string): FaqMatchResult {
  const norm = normalizeText(query);
  const defaultFallback =
    "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support.";

  if (!norm) {
    return {
      matched: false,
      answer: defaultFallback,
      confidence: 'none',
      score: 0,
      suggestedQuestions: getSuggestedQuestions()
    };
  }

  let bestMatch: FaqItem | null = null;
  let highestScore = 0;

  for (const faq of FAQ_DATA) {
    let score = 0;
    const normQ = normalizeText(faq.question);

    // 1. Exact Question Match
    if (norm === normQ) {
      score = 100;
    }
    // 2. Exact or Substring Alias Match
    else if (
      faq.aliases &&
      faq.aliases.some((alias) => {
        const normA = normalizeText(alias);
        return norm === normA || norm.includes(normA) || normA.includes(norm);
      })
    ) {
      score = 90;
    }
    // 3. Phrase Match
    else if (normQ.includes(norm) || norm.includes(normQ)) {
      score = 75;
    }
    // 4. Keyword Frequencies
    else if (faq.keywords && faq.keywords.length > 0) {
      const queryWords = norm.split(' ');
      let matchCount = 0;
      for (const kw of faq.keywords) {
        const normKw = normalizeText(kw);
        if (
          queryWords.some(
            (w) => w === normKw || (w.length > 3 && normKw.includes(w))
          )
        ) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        score = Math.min(
          70,
          Math.round(
            (matchCount / queryWords.length) * 50 +
              (matchCount / faq.keywords.length) * 20
          )
        );
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && highestScore >= 35) {
    let confLabel: 'exact' | 'high' | 'medium' | 'low' = 'high';
    if (highestScore >= 90) confLabel = 'exact';
    else if (highestScore < 50) confLabel = 'low';
    else if (highestScore < 75) confLabel = 'medium';

    return {
      matched: true,
      faqId: bestMatch.id,
      category: bestMatch.category,
      answer: bestMatch.answer,
      confidence: confLabel,
      score: highestScore,
      relatedFaqIds: bestMatch.relatedFaqIds || [],
      relatedActions: bestMatch.relatedActions || [],
      suggestedQuestions: getSuggestedQuestions(bestMatch.id)
    };
  }

  return {
    matched: false,
    answer: defaultFallback,
    confidence: 'none',
    score: highestScore,
    suggestedQuestions: getSuggestedQuestions()
  };
}

export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const item of FAQ_DATA) {
    categories.add(item.category);
  }
  return Array.from(categories);
}

export function getFaqsByCategory(category: string): FaqItem[] {
  return FAQ_DATA.filter((item) => item.category === category);
}

export function getSuggestedQuestions(excludeFaqId?: string): string[] {
  return FAQ_DATA.filter((item) => item.id !== excludeFaqId)
    .slice(0, 4)
    .map((item) => item.question);
}

export function getFaqById(id: string): FaqItem | undefined {
  return FAQ_DATA.find((item) => item.id === id);
}
