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

export interface Platform {
  name: string;
  price: number;
  pricePrefix?: string;
  url: string;
  isSmartDeal: boolean;
  /** The actual listing title on this platform (may differ from the query title) */
  productTitle?: string;
  /** How well this platform listing matches the reference listing */
  matchStatus?: MatchStatus;
  matchConfidence?: number;
  matchedAttributes?: string[];
  differingAttributes?: string[];
  matchReasons?: string[];
  /** Unit price fields — populated for unit_price_only matches */
  unitPriceA?: number | null;
  unitPriceB?: number | null;
  unitLabel?: string | null;
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
  brand: string;
  category: string;
  imageUrl: string;
  platforms: Platform[];
  price_history?: PriceHistoryItem[];
  aiPrediction: AiPrediction;
  /** Structured comparison summary — tells UI how safe it is to compare prices */
  comparisonSummary?: ComparisonSummary;
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

