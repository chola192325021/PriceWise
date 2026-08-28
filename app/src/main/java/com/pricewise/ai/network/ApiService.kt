package com.pricewise.ai.network

import com.pricewise.ai.model.*
import retrofit2.Response
import retrofit2.http.*

data class SetAlertRequest(
    val userId: String,
    val productId: String,
    val targetPrice: Double
)

interface ApiService {
    @POST("login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("signup")
    suspend fun signUp(@Body request: SignUpRequest): Response<SignUpResponse>

    @PUT("user/update")
    suspend fun updateProfile(@Body request: Map<String, String>): Response<LoginResponse>

    @GET("user/profile")
    suspend fun getUserProfile(@Query("userId") userId: String): Response<LoginResponse>

    @GET("products")
    suspend fun getProducts(@Query("search") search: String? = null): Response<ProductListResponse>

    @GET("products/search-live")
    suspend fun searchLive(
        @Query("query") query: String,
        @Query("category") category: String? = null,
        @Query("source") source: String? = null
    ): Response<ProductListResponse>

    @GET("products/{id}/price-forecast")
    suspend fun getPriceForecast(@Path("id") productId: String): Response<PriceForecastResponse>

    @GET("products/{id}")
    suspend fun getProductById(@Path("id") id: String): Response<SingleProductResponse>

    @GET("user/alerts")
    suspend fun getUserAlerts(@Query("userId") userId: String): Response<UserAlertsResponse>

    @GET("user/watchlist")
    suspend fun getUserWatchlist(@Query("userId") userId: String): Response<ProductListResponse>

    @GET("user/tracking")
    suspend fun getUserTracking(@Query("userId") userId: String): Response<ProductListResponse>

    @POST("products/track")
    suspend fun trackProduct(@Body request: Map<String, String>): Response<Map<String, Any>>

    @POST("user/watchlist/add")
    suspend fun addToWatchlist(@Body request: Map<String, String>): Response<LoginResponse>

    @POST("user/watchlist/remove")
    suspend fun removeFromWatchlist(@Body request: Map<String, String>): Response<LoginResponse>

    @POST("user/alerts/set")
    suspend fun setPriceAlert(@Body request: SetAlertRequest): Response<LoginResponse>

    @POST("user/alerts/remove")
    suspend fun removePriceAlert(@Body request: Map<String, String>): Response<LoginResponse>

    @POST("products/watchlist/refresh")
    suspend fun refreshWatchlist(@Body request: Map<String, String>): Response<Map<String, Any>>

    @POST("chat")
    suspend fun sendChatMessage(@Body request: ChatRequest): Response<ChatResponse>

    @POST("sync-account")
    suspend fun syncAccount(@Body request: Map<String, String>): Response<com.pricewise.ai.model.LoginResponse>

    @POST("forgot-password")
    suspend fun forgotPassword(@Body request: Map<String, String>): Response<com.pricewise.ai.model.LoginResponse>

    @POST("resend-forgot-password")
    suspend fun resendForgotPassword(@Body request: Map<String, String>): Response<com.pricewise.ai.model.LoginResponse>

    @POST("reset-password")
    suspend fun resetPassword(@Body request: Map<String, String>): Response<com.pricewise.ai.model.LoginResponse>
}
