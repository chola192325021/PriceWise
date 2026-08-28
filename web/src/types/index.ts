export interface User {
  id: string;
  email: string;
  name: string;
  profilePhoto?: string;
  profilePhotoUrl?: string;
  profile_photo?: string;
  memberSince?: string;
  watchlist?: string[];
  alerts?: AlertItem[];
}

export interface AlertItem {
  productId: string;
  targetPrice: number;
}

/** Structured match result for a platform listing vs. the reference listing. */
export type MatchStatus = 'exact_match' | 'variant_match' | 'unit_price_only' | 'no_match' | 'reference';

export interface PricePerUnit {
  value: number;
  unit: string;
}

export interface UrlValidation {
  isValid: boolean;
  status: 'valid' | 'invalid_url' | 'wrong_source' | 'dead_link' | 'all_candidates_invalid' | 'soft_404' | 'unavailable';
  originalUrl?: string;
  finalUrl?: string;
  canonicalUrl?: string;
  reason?: string | null;
  checkedAt?: string;
}

export interface Platform {
  name: string;
  price: number;
  pricePrefix?: string;
  url: string;
  urlValidation?: UrlValidation;
  isSmartDeal: boolean;
  /** The actual listing title on this platform (may differ from the query title) */
  productTitle?: string | null;
  /** Clean title extracted without UI artifacts */
  cleanTitle?: string | null;
  rawTitle?: string | null;
  /** How well this platform listing matches the reference listing */
  matchStatus?: MatchStatus;
  status?: MatchStatus;
  matchConfidence?: number;
  confidence?: number;
  matchedAttributes?: string[];
  differingAttributes?: string[];
  differences?: string[];
  matchReasons?: string[];
  reason?: string;
  /** Flag indicating if this platform is eligible for exact price comparison */
  comparisonEligible?: boolean;
  /** Unit price fields — populated for unit_price_only matches */
  pricePerUnit?: PricePerUnit | null;
  unitPriceA?: number | null;
  unitPriceB?: number | null;
  unitLabel?: string | null;
}

export interface PlatformResult {
  source: string;
  status: MatchStatus;
  comparisonEligible: boolean;
  confidence: number;
  product: {
    title: string;
    price: number;
    currency: string;
    url: string;
    imageUrl: string;
    available: boolean;
    brand?: string;
    model?: string;
    attributes?: Record<string, any>;
  } | null;
  urlValidation?: UrlValidation;
  differences: string[];
  pricePerUnit: PricePerUnit | null;
  reason: string;
}

export interface SimilarProduct {
  source: string;
  title: string;
  price: number;
  url: string;
  urlValidation?: UrlValidation;
  imageUrl?: string;
  matchType: 'similar';
  similarityTier: 'close_variant' | 'comparable_alternative' | 'related_product';
  confidence: number;
  differences: string[];
  comparisonEligible: boolean;
}

export interface PriceHistoryItem {
  price: number;
  date: string;
}

export interface AiPrediction {
  status: string;
  trend: 'drop' | 'stable' | 'rise' | 'insufficient';
  expectedPrice: number | null;
  currentBestPrice: number;
  bestPlatform: string;
  observedLowPrice: number;
  historyDays: number;
  recommendation: 'BUY_NOW' | 'WAIT' | 'MONITOR' | 'TRACKING';
  confidence: number;
  confidenceLabel: 'Low' | 'Medium' | 'High';
  message: string;
  reason: string;
}

/** Top-level comparison summary for a product's cross-platform match quality. */
export interface ComparisonSummary {
  comparisonType: 'exact_match' | 'variant_match' | 'unit_price_only' | 'no_match';
  comparisonWarning?: string | null;
  unitPriceLabel?: string | null;
}

export interface Product {
  _id: string;
  title: string;
  cleanTitle?: string;
  rawTitle?: string;
  brand: string;
  category: string;
  imageUrl: string;
  platforms: Platform[];
  platformResults?: PlatformResult[];
  bestExactPrice?: { source: string; price: number } | null;
  similarProducts?: SimilarProduct[];
  noExactMatchMessage?: string | null;
  price_history?: PriceHistoryItem[];
  aiPrediction: AiPrediction;
  /** Structured comparison summary — tells UI how safe it is to compare prices */
  comparisonSummary?: ComparisonSummary;
  query?: {
    title: string;
    cleanTitle?: string;
    normalizedTitle?: string;
  };
}

export interface LoginResponse {
  status: string;
  token?: string;
  user: User;
  message?: string;
}

export interface ProductListResponse {
  status: string;
  data: Product[];
}

export interface SingleProductResponse {
  status: string;
  data: Product;
}

export interface UserAlertItem {
  productId: string;
  targetPrice: number;
  product: Product;
}

export interface UserAlertsResponse {
  status: string;
  data: UserAlertItem[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export interface ForecastPoint {
  timestamp: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
}

export interface ChronosForecast {
  productId: string;
  sourceId: string;
  currency: string;
  model: string;
  forecastGeneratedAt: string;
  interval: string;
  horizon: number;
  historyPoints: number;
  currentPrice: number;
  trend: 'likely_decrease' | 'likely_increase' | 'likely_stable' | 'insufficient';
  confidence: 'low' | 'medium' | 'high';
  isEstimate: boolean;
  forecast: ForecastPoint[];
  warning?: string | null;
}

export interface PriceForecastResponse {
  status: string;
  data: ChronosForecast;
}

