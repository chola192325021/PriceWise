package com.pricewise.ai.model

import com.google.gson.annotations.SerializedName

data class ProductListResponse(
    @SerializedName("status") val status: String,
    @SerializedName("data") val data: List<Product>
)

data class SingleProductResponse(
    @SerializedName("status") val status: String,
    @SerializedName("data") val data: Product
)

data class UserAlertItem(
    @SerializedName("productId") val productId: String,
    @SerializedName("targetPrice") val targetPrice: Double,
    @SerializedName("product") val product: Product
)

data class UserAlertsResponse(
    @SerializedName("status") val status: String,
    @SerializedName("data") val data: List<UserAlertItem>
)

data class Product(
    @SerializedName("_id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("brand") val brand: String,
    @SerializedName("category") val category: String,
    @SerializedName("imageUrl") val imageUrl: String,
    @SerializedName("platforms") val platforms: List<Platform>,
    @SerializedName("aiPrediction") val aiPrediction: AiPrediction,
    /** Structured comparison summary — tells UI how trustworthy the price comparison is */
    @SerializedName("comparisonSummary") val comparisonSummary: ComparisonSummary? = null
)

/**
 * How well a platform listing matches the reference listing.
 * Values: "exact_match", "variant_match", "unit_price_only", "no_match", "reference"
 */
data class Platform(
    @SerializedName("name") val name: String,
    @SerializedName("price") val price: Double,
    @SerializedName("pricePrefix") val pricePrefix: String? = null,
    @SerializedName("url") val url: String,
    @SerializedName("isSmartDeal") val isSmartDeal: Boolean,
    /** The actual listing title on this platform (may differ from the product title) */
    @SerializedName("productTitle") val productTitle: String? = null,
    /** Match quality relative to the reference listing */
    @SerializedName("matchStatus") val matchStatus: String? = null,
    @SerializedName("matchConfidence") val matchConfidence: Double? = null,
    @SerializedName("matchedAttributes") val matchedAttributes: List<String>? = null,
    @SerializedName("differingAttributes") val differingAttributes: List<String>? = null,
    @SerializedName("matchReasons") val matchReasons: List<String>? = null,
    /** Unit price fields — populated for unit_price_only matches */
    @SerializedName("unitPriceA") val unitPriceA: Double? = null,
    @SerializedName("unitPriceB") val unitPriceB: Double? = null,
    @SerializedName("unitLabel") val unitLabel: String? = null
)

/** Top-level comparison summary for the whole product's cross-platform match quality. */
data class ComparisonSummary(
    /** "exact_match" | "variant_match" | "unit_price_only" | "no_match" */
    @SerializedName("comparisonType") val comparisonType: String,
    @SerializedName("comparisonWarning") val comparisonWarning: String? = null,
    @SerializedName("unitPriceLabel") val unitPriceLabel: String? = null
)

data class AiPrediction(
    @SerializedName("trend") val trend: String,
    @SerializedName("expectedPrice") val expectedPrice: Double,
    @SerializedName("recommendation") val recommendation: String,
    @SerializedName("confidence") val confidence: Int
)

data class ForecastPoint(
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("predictedPrice") val predictedPrice: Double,
    @SerializedName("lowerBound") val lowerBound: Double,
    @SerializedName("upperBound") val upperBound: Double
)

data class ChronosForecastData(
    @SerializedName("productId") val productId: String,
    @SerializedName("sourceId") val sourceId: String,
    @SerializedName("currency") val currency: String,
    @SerializedName("model") val model: String,
    @SerializedName("forecastGeneratedAt") val forecastGeneratedAt: String,
    @SerializedName("interval") val interval: String,
    @SerializedName("horizon") val horizon: Int,
    @SerializedName("historyPoints") val historyPoints: Int,
    @SerializedName("currentPrice") val currentPrice: Double,
    @SerializedName("trend") val trend: String,
    @SerializedName("confidence") val confidence: String,
    @SerializedName("isEstimate") val isEstimate: Boolean,
    @SerializedName("forecast") val forecast: List<ForecastPoint>,
    @SerializedName("warning") val warning: String? = null
)

data class PriceForecastResponse(
    @SerializedName("status") val status: String,
    @SerializedName("data") val data: ChronosForecastData
)