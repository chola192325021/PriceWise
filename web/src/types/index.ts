export interface User {
  id: string;
  email: string;
  name: string;
  profilePhoto?: string;
  memberSince?: string;
  watchlist?: string[];
  alerts?: AlertItem[];
}

export interface AlertItem {
  productId: string;
  targetPrice: number;
}

export interface Platform {
  name: string;
  price: number;
  pricePrefix?: string;
  url: string;
  isSmartDeal: boolean;
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

export interface Product {
  _id: string;
  title: string;
  brand: string;
  category: string;
  imageUrl: string;
  platforms: Platform[];
  price_history?: PriceHistoryItem[];
  aiPrediction: AiPrediction;
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

