import { Product } from '../types';

export interface SearchState {
  inputText: string;
  submittedQuery: string | null;
  results: Product[];
  hasSearched: boolean;
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  scrollPosition: number;
  lastSuccessfulQuery: string | null;
  lastFetchedAt: number | null;
}

const queryCache = new Map<string, { products: Product[]; timestamp: number }>();

let currentState: SearchState = {
  inputText: '',
  submittedQuery: null,
  results: [],
  hasSearched: false,
  isLoading: false,
  error: null,
  selectedCategory: 'All',
  scrollPosition: 0,
  lastSuccessfulQuery: null,
  lastFetchedAt: null,
};

export const searchStore = {
  getState(): SearchState {
    return { ...currentState };
  },

  setState(partial: Partial<SearchState>): SearchState {
    currentState = { ...currentState, ...partial };
    return { ...currentState };
  },

  getCachedResults(query: string): Product[] | null {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    const entry = queryCache.get(normalized);
    if (entry && Array.isArray(entry.products)) {
      return entry.products;
    }
    return null;
  },

  setCachedResults(query: string, products: Product[]) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    queryCache.set(normalized, {
      products,
      timestamp: Date.now()
    });
  },

  saveScroll(position: number) {
    currentState.scrollPosition = position;
  },

  getSavedScroll(): number {
    return currentState.scrollPosition;
  },

  logSearchEvent(cause: 'USER_SUBMIT' | 'USER_REFRESH' | 'USER_RETRY', query: string, cacheHit: boolean) {
    console.debug('[PriceWiseSearch]', {
      cause,
      queryLength: query.length,
      route: window.location.pathname,
      isBackNavigation: false,
      cacheHit
    });
  }
};

export default searchStore;
