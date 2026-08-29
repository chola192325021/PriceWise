package com.pricewise.ai.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pricewise.ai.model.*
import com.pricewise.ai.network.RetrofitInstance
import com.pricewise.ai.network.SetAlertRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import android.util.Log

class AuthViewModel : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    private val _signUpState = MutableStateFlow<SignUpState>(SignUpState.Idle)
    val signUpState: StateFlow<SignUpState> = _signUpState

    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser

    private val defaultMockProducts = listOf(
        Product(
            id = "mock_1",
            title = "Apple iPhone 15 (128 GB) - Blue",
            brand = "Apple",
            category = "Electronics",
            imageUrl = "https://m.media-amazon.com/images/I/71d7rfSl0wL._SL1500_.jpg",
            platforms = listOf(
                Platform(name = "Amazon", price = 71290.0, url = "https://www.amazon.in/dp/B0CHX1W1XY", isSmartDeal = false),
                Platform(name = "Flipkart", price = 69999.0, pricePrefix = "Starting from ", url = "https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itmbf14ef54f645d", isSmartDeal = true),
                Platform(name = "Croma", price = 72900.0, url = "https://www.croma.com/apple-iphone-15-128gb-blue-/p/300822", isSmartDeal = false)
            ),
            aiPrediction = AiPrediction(trend = "drop", expectedPrice = 67500.0, recommendation = "Historic Low expected soon! Wait 3-5 days.", confidence = 92)
        ),
        Product(
            id = "mock_2",
            title = "Sony WH-1000XM5 Wireless Headphones",
            brand = "Sony",
            category = "Electronics",
            imageUrl = "https://m.media-amazon.com/images/I/61+btxzpfDL._SL1500_.jpg",
            platforms = listOf(
                Platform(name = "Flipkart", price = 26990.0, pricePrefix = "Starting from ", url = "https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm53cf7e4aa040d", isSmartDeal = true),
                Platform(name = "Amazon", price = 28990.0, url = "https://www.amazon.in/dp/B09XS7JWHH", isSmartDeal = false)
            ),
            aiPrediction = AiPrediction(trend = "stable", expectedPrice = 26990.0, recommendation = "Price is stable. Great deal on Flipkart.", confidence = 85)
        ),
        Product(
            id = "mock_3",
            title = "Nike Air Max 270 Running Shoes",
            brand = "Nike",
            category = "Fashion",
            imageUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
            platforms = listOf(
                Platform(name = "Amazon", price = 8995.0, url = "https://www.amazon.in/dp/B0787H96K6", isSmartDeal = true),
                Platform(name = "Meesho", price = 9499.0, url = "https://www.meesho.com/nike-air-max-270-running-shoes/p/2x4y6z", isSmartDeal = false)
            ),
            aiPrediction = AiPrediction(trend = "rise", expectedPrice = 9999.0, recommendation = "Price expected to rise! Buy now.", confidence = 88)
        ),
        Product(
            id = "mock_4",
            title = "Samsung Galaxy S24 Ultra 5G",
            brand = "Samsung",
            category = "Electronics",
            imageUrl = "https://m.media-amazon.com/images/I/71RVuW369lL._SL1500_.jpg",
            platforms = listOf(
                Platform(name = "Amazon", price = 129999.0, url = "https://www.amazon.in/dp/B0CS5X6JCD", isSmartDeal = true),
                Platform(name = "Flipkart", price = 131999.0, url = "https://www.flipkart.com/samsung-galaxy-s24-ultra-5g-titanium-gray-256-gb/p/itm3d25ef6ab1332", isSmartDeal = false, pricePrefix = "Starting from ")
            ),
            aiPrediction = AiPrediction(trend = "drop", expectedPrice = 124999.0, recommendation = "Wait for festival sale price drop.", confidence = 90)
        ),
        Product(
            id = "mock_5",
            title = "Men's Slim Fit Cotton Casual Shirt",
            brand = "Puma",
            category = "Fashion",
            imageUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
            platforms = listOf(
                Platform(name = "Meesho", price = 699.0, url = "https://www.meesho.com/mens-slim-fit-cotton-casual-shirt/p/3m5n7p", isSmartDeal = true),
                Platform(name = "Flipkart", price = 899.0, pricePrefix = "Starting from ", url = "https://www.flipkart.com/puma-men-solid-casual-shirt/p/itm8901234567890", isSmartDeal = false)
            ),
            aiPrediction = AiPrediction(trend = "stable", expectedPrice = 699.0, recommendation = "Best price guaranteed on Meesho.", confidence = 80)
        ),
        Product(
            id = "mock_6",
            title = "Dell XPS 13 Intel Core i7 Laptop",
            brand = "Dell",
            category = "Electronics",
            imageUrl = "https://images.unsplash.com/photo-1593642632823-8f785ba67e45",
            platforms = listOf(
                Platform(name = "Amazon", price = 114990.0, url = "https://www.amazon.in/dp/B0B5HSJ212", isSmartDeal = true),
                Platform(name = "Croma", price = 119990.0, url = "https://www.croma.com/dell-xps-13-intel-core-i7-laptop/p/261234", isSmartDeal = false)
            ),
            aiPrediction = AiPrediction(trend = "drop", expectedPrice = 109990.0, recommendation = "Price drop predicted in 1 week.", confidence = 87)
        )
    )

    private val _products = MutableStateFlow<List<Product>>(defaultMockProducts)
    val products = _products.asStateFlow()

    private val _searchUiState = MutableStateFlow(SearchUiState())
    val searchUiState: StateFlow<SearchUiState> = _searchUiState.asStateFlow()

    private val _searchResults = MutableStateFlow<List<Product>>(emptyList())
    val searchResults = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching = _isSearching.asStateFlow()

    private var activeSearchJob: kotlinx.coroutines.Job? = null

    fun updateSearchInput(newText: String) {
        // UI-only update; NEVER triggers network/scraper search
        _searchUiState.value = _searchUiState.value.copy(inputText = newText)
    }

    fun clearSearchInput() {
        _searchUiState.value = _searchUiState.value.copy(inputText = "")
    }

    fun submitSearch(query: String, cause: String = "USER_SUBMIT", forceRefresh: Boolean = false) {
        val normalizedQuery = query.trim()
        if (normalizedQuery.isEmpty()) {
            return
        }

        val validCauses = setOf("USER_SUBMIT", "USER_REFRESH", "USER_RETRY")
        val safeCause = if (validCauses.contains(cause)) cause else "USER_SUBMIT"

        // Duplicate protection: if already loaded and identical query without force refresh, reuse results
        val currentState = _searchUiState.value
        if (!forceRefresh && safeCause != "USER_REFRESH" &&
            currentState.lastSuccessfulQuery.equals(normalizedQuery, ignoreCase = true) &&
            currentState.results.isNotEmpty()
        ) {
            _searchUiState.value = currentState.copy(
                inputText = normalizedQuery,
                submittedQuery = normalizedQuery,
                hasSearched = true,
                isLoading = false,
                error = null
            )
            return
        }

        // Prevent duplicate concurrent requests for the exact same query
        if (currentState.isLoading && currentState.submittedQuery.equals(normalizedQuery, ignoreCase = true) && !forceRefresh) {
            return
        }

        Log.d("PriceWiseSearch", "Search request started: cause=$safeCause queryLength=${normalizedQuery.length}")

        activeSearchJob?.cancel()
        activeSearchJob = viewModelScope.launch {
            _isSearching.value = true
            _searchUiState.value = _searchUiState.value.copy(
                inputText = normalizedQuery,
                submittedQuery = normalizedQuery,
                isLoading = true,
                error = null,
                hasSearched = true
            )

            try {
                val response = RetrofitInstance.api.searchLive(normalizedQuery)
                if (response.isSuccessful && response.body() != null) {
                    val items = response.body()!!.data ?: emptyList()
                    _searchResults.value = items
                    _searchUiState.value = _searchUiState.value.copy(
                        results = items,
                        isLoading = false,
                        error = null,
                        hasSearched = true,
                        lastSuccessfulQuery = normalizedQuery
                    )
                } else {
                    _searchResults.value = emptyList()
                    _searchUiState.value = _searchUiState.value.copy(
                        results = emptyList(),
                        isLoading = false,
                        error = null,
                        hasSearched = true,
                        lastSuccessfulQuery = normalizedQuery
                    )
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error fetching search results", e)
                _searchResults.value = emptyList()
                _searchUiState.value = _searchUiState.value.copy(
                    results = emptyList(),
                    isLoading = false,
                    error = "Failed to fetch live prices. Please retry.",
                    hasSearched = true
                )
            } finally {
                _isSearching.value = false
            }
        }
    }

    private val _isAmazonSynced = MutableStateFlow(false)
    val isAmazonSynced = _isAmazonSynced.asStateFlow()

    private val _isFlipkartSynced = MutableStateFlow(false)
    val isFlipkartSynced = _isFlipkartSynced.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage = _syncMessage.asStateFlow()

    private val _trackMessage = MutableStateFlow<String?>(null)
    val trackMessage = _trackMessage.asStateFlow()

    private val _watchlistProducts = MutableStateFlow<List<Product>>(emptyList())
    val watchlistProducts = _watchlistProducts.asStateFlow()

    private val _isDarkTheme = MutableStateFlow<Boolean?>(null)
    val isDarkTheme: StateFlow<Boolean?> = _isDarkTheme

    fun setDarkTheme(isDark: Boolean?) {
        _isDarkTheme.value = isDark
    }

    init {
        // Fetch products from database for the home page (all categories)
        fetchProducts("")
        // For testing, automatically load a valid user
        fetchCurrentUser()
    }

    private fun fetchCurrentUser() {
        viewModelScope.launch {
            try {
                // We'll use a dummy login call to fetch the user state
                val request = LoginRequest("cholapinapala2005@gmail.com", "password")
                val response = RetrofitInstance.api.login(request)
                if (response.isSuccessful && response.body()?.status == "success") {
                    _currentUser.value = response.body()?.user
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error fetching user", e)
            }
        }
    }

    fun fetchProducts(query: String = "", category: String? = null, source: String? = null) {
        if (query.isNotEmpty()) {
            submitSearch(query, cause = "USER_SUBMIT")
            return
        }
        viewModelScope.launch {
            try {
                val response = RetrofitInstance.api.getProducts()
                if (response.isSuccessful && response.body() != null) {
                    val items = response.body()!!.data
                    _products.value = items ?: emptyList()
                } else {
                    handleFallbackProducts("")
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error fetching products", e)
                handleFallbackProducts("")
            }
        }
    }

    fun getProductById(id: String): Product? {
        val all = _products.value + _searchResults.value + _userWatchlist.value + _watchlistProducts.value + defaultMockProducts
        return all.find { it.id == id || it.id.equals(id, ignoreCase = true) }
    }

    private val _productDetailState = MutableStateFlow<Map<String, ProductDetailUiState>>(emptyMap())
    val productDetailState = _productDetailState.asStateFlow()

    fun loadProductDetail(productId: String, forceRefresh: Boolean = false) {
        if (productId.isBlank()) {
            _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Error("This product information is missing or incomplete.", canRetry = false))
            return
        }

        // Check if already in local cache
        val cached = getProductById(productId)
        if (cached != null && !forceRefresh) {
            _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Success(cached))
            Log.d("PriceWiseProductDetail", "Loaded product detail from local cache: id=$productId, title=${cached.title}")
            return
        }

        viewModelScope.launch {
            _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Loading)
            Log.d("PriceWiseProductDetail", "Fetching product detail from API: id=$productId")
            try {
                val response = RetrofitInstance.api.getProductById(productId)
                val isSuccess = response.isSuccessful
                val httpCode = response.code()
                val body = response.body()
                Log.d("PriceWiseProductDetail", "Product detail API response: success=$isSuccess, code=$httpCode, hasBody=${body != null}")

                if (isSuccess && body != null && body.status == "success") {
                    val product = body.data
                    _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Success(product))
                    if (_products.value.none { it.id == product.id }) {
                        _products.value = _products.value + product
                    }
                } else if (httpCode == 404) {
                    _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Error("This product is no longer available.", canRetry = false))
                } else {
                    val fallback = getProductById(productId)
                    if (fallback != null) {
                        _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Success(fallback))
                    } else {
                        _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Error("Unable to load product details (HTTP $httpCode).", canRetry = true))
                    }
                }
            } catch (cancel: kotlinx.coroutines.CancellationException) {
                throw cancel
            } catch (e: Exception) {
                Log.e("PriceWiseProductDetail", "Product detail fetch error: ${e.javaClass.simpleName}: ${e.message}")
                val fallback = getProductById(productId)
                if (fallback != null) {
                    _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Success(fallback))
                } else {
                    val msg = if (!e.message.isNullOrBlank()) "Connection error: ${e.message}" else "Unable to load product details. Please check your connection and try again."
                    _productDetailState.value = _productDetailState.value + (productId to ProductDetailUiState.Error(msg, canRetry = true))
                }
            }
        }
    }

    private val _userAlerts = MutableStateFlow<List<UserAlertItem>>(emptyList())
    val userAlerts = _userAlerts.asStateFlow()

    private val _userWatchlist = MutableStateFlow<List<Product>>(emptyList())
    val userWatchlist = _userWatchlist.asStateFlow()

    fun fetchUserAlerts() {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val res = RetrofitInstance.api.getUserAlerts(userId)
                if (res.isSuccessful && res.body()?.status == "success") {
                    _userAlerts.value = res.body()?.data ?: emptyList()
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error fetching user alerts", e)
            }
        }
    }

    fun fetchUserWatchlist() {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val res = RetrofitInstance.api.getUserWatchlist(userId)
                if (res.isSuccessful && res.body()?.status == "success") {
                    val list = res.body()?.data ?: emptyList()
                    _userWatchlist.value = list
                    // Cache watchlist items into product detail states
                    list.forEach { p ->
                        if (_productDetailState.value[p.id] !is ProductDetailUiState.Success) {
                            _productDetailState.value = _productDetailState.value + (p.id to ProductDetailUiState.Success(p))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error fetching user watchlist", e)
            }
        }
    }

    private fun handleFallbackProducts(query: String) {
        if (query.isEmpty()) {
            if (_products.value.isEmpty()) {
                _products.value = defaultMockProducts
            }
        } else {
            // For live search queries, zero results from API returns real empty list (no mock fallback)
            _searchResults.value = emptyList()
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _loginState.value = LoginState.Loading
            try {
                val request = LoginRequest(email.trim().lowercase(), password)
                val response = RetrofitInstance.api.login(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val loginResponse = response.body()!!
                    _currentUser.value = loginResponse.user
                    _loginState.value = LoginState.Success(loginResponse)
                    fetchProducts("")
                } else {
                    val errorMsg = try {
                        val errorJson = response.errorBody()?.string()
                        if (errorJson != null) org.json.JSONObject(errorJson).optString("message", "Invalid email or password") else null
                    } catch (ex: Exception) { null }
                    _loginState.value = LoginState.Error(errorMsg ?: response.body()?.message ?: "Invalid email or password")
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Server unreachable during login", e)
                val msg = if (!e.message.isNullOrBlank()) "Connection error: ${e.message}" else "Connection error. Please verify backend is running."
                _loginState.value = LoginState.Error(msg)
            }
        }
    }

    fun signUp(name: String, email: String, password: String) {
        viewModelScope.launch {
            _signUpState.value = SignUpState.Loading
            try {
                val request = SignUpRequest(name.trim(), email.trim().lowercase(), password)
                val response = RetrofitInstance.api.signUp(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val signUpResponse = response.body()!!
                    val userData = signUpResponse.user
                    _currentUser.value = if (userData != null) {
                        User(id = userData.id, email = userData.email, name = userData.name, profilePhoto = userData.profilePhoto, profilePhotoUrl = userData.profilePhotoUrl, profile_photo = userData.profile_photo, memberSince = userData.memberSince)
                    } else null
                    _signUpState.value = SignUpState.Success(signUpResponse)
                    fetchProducts("")
                } else {
                    val errorMsg = try {
                        val errorJson = response.errorBody()?.string()
                        if (errorJson != null) org.json.JSONObject(errorJson).optString("message", "Failed to create account") else null
                    } catch (ex: Exception) { null }
                    _signUpState.value = SignUpState.Error(errorMsg ?: "Failed to create account. User may already exist.")
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Server unreachable during signup", e)
                val msg = if (!e.message.isNullOrBlank()) "Connection error: ${e.message}" else "Connection error. Please try again."
                _signUpState.value = SignUpState.Error(msg)
            }
        }
    }

    fun logout() {
        _currentUser.value = null
        _searchResults.value = emptyList()
        _watchlistProducts.value = emptyList()
        _userAlerts.value = emptyList()
        _userWatchlist.value = emptyList()
        resetStates()
    }

    fun syncLinkedAccount(provider: String, onComplete: (Boolean) -> Unit) {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val request = mapOf("userId" to userId)
                val response = RetrofitInstance.api.refreshWatchlist(request)
                if (response.isSuccessful) {
                    val updated = (response.body()?.get("updated") as? Double)?.toInt() ?: 0
                    if (provider.equals("Amazon", ignoreCase = true)) _isAmazonSynced.value = true
                    else if (provider.equals("Flipkart", ignoreCase = true)) _isFlipkartSynced.value = true
                    fetchProducts("") // Refresh products with new scraped prices
                    onComplete(true)
                } else {
                    onComplete(false)
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Sync error", e)
                onComplete(false)
            }
        }
    }

    fun resetStates() {
        _loginState.value = LoginState.Idle
        _signUpState.value = SignUpState.Idle
    }

    fun sendPasswordResetCode(email: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            try {
                val request = mapOf("email" to email)
                val response = RetrofitInstance.api.forgotPassword(request)
                if (response.isSuccessful && response.body()?.status == "success") {
                    onResult(true, response.body()?.message ?: "Verification code sent to email")
                } else {
                    val errorMsg = try {
                        val errorJson = response.errorBody()?.string()
                        if (errorJson != null) org.json.JSONObject(errorJson).getString("message") else null
                    } catch (e: Exception) { null }
                    
                    onResult(false, errorMsg ?: response.body()?.message ?: "Failed to send code")
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "Connection error")
            }
        }
    }

    fun resendPasswordResetCode(email: String, onResult: (Boolean, String, Int?) -> Unit) {
        viewModelScope.launch {
            try {
                val request = mapOf("email" to email)
                val response = RetrofitInstance.api.resendForgotPassword(request)
                if (response.isSuccessful && response.body()?.status == "success") {
                    onResult(true, response.body()?.message ?: "Verification code resent", null)
                } else {
                    var remainingSeconds: Int? = null
                    val errorMsg = try {
                        val errorBodyStr = response.errorBody()?.string()
                        if (errorBodyStr != null) {
                            val json = org.json.JSONObject(errorBodyStr)
                            if (json.has("remainingSeconds")) {
                                remainingSeconds = json.getInt("remainingSeconds")
                            }
                            if (json.has("message")) json.getString("message") else null
                        } else null
                    } catch (e: Exception) { null }
                    
                    onResult(false, errorMsg ?: response.body()?.message ?: "Failed to resend code", remainingSeconds)
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "Connection error", null)
            }
        }
    }

    fun resetPassword(email: String, code: String, newPassword: String, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            try {
                val request = mapOf("email" to email, "code" to code, "newPassword" to newPassword)
                val response = RetrofitInstance.api.resetPassword(request)
                if (response.isSuccessful && response.body()?.status == "success") {
                    onResult(true, "Password updated successfully")
                } else {
                    onResult(false, response.body()?.message ?: "Failed to reset password")
                }
            } catch (e: Exception) {
                onResult(false, e.message ?: "Connection error")
            }
        }
    }

    fun updateProfile(name: String, email: String, profilePhoto: String) {
        val current = _currentUser.value
        val userId = current?.id
        
        if (userId == null) {
            Log.e("AuthViewModel", "Cannot update profile: User ID is null")
            return
        }

        viewModelScope.launch {
            try {
                val request = mapOf(
                    "id" to userId,
                    "name" to name,
                    "email" to email,
                    "profilePhoto" to profilePhoto,
                    "profilePhotoUrl" to profilePhoto,
                    "profile_photo" to profilePhoto
                )
                val response = RetrofitInstance.api.updateProfile(request)
                if (response.isSuccessful && response.body() != null && response.body()?.user != null) {
                    _currentUser.value = response.body()!!.user
                    Log.d("PriceWiseProfile", "Profile updated successfully: ${_currentUser.value?.name}")
                } else {
                    Log.e("PriceWiseProfile", "Profile update failed: ${response.message()}")
                }
            } catch (e: Exception) {
                Log.e("PriceWiseProfile", "Profile update exception", e)
            }
        }
    }

    fun fetchUserProfile(userId: String? = _currentUser.value?.id) {
        val targetId = userId ?: return
        viewModelScope.launch {
            try {
                val response = RetrofitInstance.api.getUserProfile(targetId)
                if (response.isSuccessful && response.body()?.user != null) {
                    val user = response.body()!!.user
                    _currentUser.value = user
                    val safeUri = user?.profilePhotoUrl?.takeIf { !com.pricewise.ai.utils.ImageUtils.isBase64Image(it) }?.let { runCatching { android.net.Uri.parse(it) }.getOrNull() }
                    Log.d(
                        "PriceWiseProfile",
                        "User profile refreshed successfully: name=${user?.name}, " +
                            "hasPhotoUrl=${!user?.photoUrl.isNullOrBlank()}, " +
                            "isBase64=${com.pricewise.ai.utils.ImageUtils.isBase64Image(user?.photoUrl)}, " +
                            "scheme=${safeUri?.scheme}, host=${safeUri?.host}, " +
                            "photoVersionPresent=${!user?.photoVersion.isNullOrBlank()}"
                    )
                }
            } catch (e: Exception) {
                Log.e("PriceWiseProfile", "Fetch user profile error", e)
            }
        }
    }

    fun trackProduct(url: String, platform: String) {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val request = mapOf("url" to url, "platform" to platform, "userId" to userId)
                val response = RetrofitInstance.api.trackProduct(request)
                if (response.isSuccessful) {
                    val newProductId = response.body()?.get("productId") as? String
                    if (newProductId != null) {
                        val currentWatchlist = _currentUser.value?.watchlist?.toMutableList() ?: mutableListOf()
                        if (!currentWatchlist.contains(newProductId)) {
                            currentWatchlist.add(newProductId)
                            _currentUser.value = _currentUser.value?.copy(watchlist = currentWatchlist)
                        }
                    }
                    // Refresh product list from server to show newly created product
                    fetchProducts("")
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error tracking product", e)
            }
        }
    }

    fun refreshWatchlist(onComplete: ((Boolean) -> Unit)? = null) {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val request = mapOf("userId" to userId)
                val response = RetrofitInstance.api.refreshWatchlist(request)
                if (response.isSuccessful) {
                    fetchProducts("")
                    onComplete?.invoke(true)
                } else {
                    onComplete?.invoke(false)
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error refreshing watchlist", e)
                onComplete?.invoke(false)
            }
        }
    }

    fun addToWatchlist(productId: String) {
        val userId = _currentUser.value?.id ?: "6a0546da31788710d8753894"
        viewModelScope.launch {
            try {
                val request = mapOf("userId" to userId, "productId" to productId)
                val response = RetrofitInstance.api.addToWatchlist(request)
                if (response.isSuccessful && response.body() != null) {
                    _currentUser.value = response.body()!!.user
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error adding to watchlist", e)
            }
        }
    }

    fun removeFromWatchlist(productId: String) {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val request = mapOf("userId" to userId, "productId" to productId)
                val response = RetrofitInstance.api.removeFromWatchlist(request)
                if (response.isSuccessful && response.body() != null) {
                    _currentUser.value = response.body()!!.user
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error removing from watchlist", e)
            }
        }
    }

    fun setPriceAlert(productId: String, targetPrice: Double) {
        // Fallback user ID for testing if currentUser is somehow null
        val userId = _currentUser.value?.id ?: "6a0546da31788710d8753894"
        viewModelScope.launch {
            try {
                val request = SetAlertRequest(userId, productId.toString(), targetPrice)
                val response = RetrofitInstance.api.setPriceAlert(request)
                if (response.isSuccessful && response.body() != null) {
                    _currentUser.value = response.body()!!.user
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error setting price alert", e)
            }
        }
    }

    fun removePriceAlert(productId: String) {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val request = mapOf("userId" to userId, "productId" to productId)
                val response = RetrofitInstance.api.removePriceAlert(request)
                if (response.isSuccessful && response.body() != null) {
                    _currentUser.value = response.body()!!.user
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error removing price alert", e)
            }
        }
    }

    fun refreshWatchlist() {
        val userId = _currentUser.value?.id ?: return
        viewModelScope.launch {
            try {
                val response = RetrofitInstance.api.refreshWatchlist(mapOf("userId" to userId))
                if (response.isSuccessful) {
                    fetchProducts("")
                }
            } catch (e: Exception) {
                Log.e("AuthViewModel", "Error refreshing watchlist", e)
            }
        }
    }
}

sealed class LoginState {
    object Idle : LoginState()
    object Loading : LoginState()
    data class Success(val data: LoginResponse) : LoginState()
    data class Error(val message: String) : LoginState()
}

sealed class SignUpState {
    object Idle : SignUpState()
    object Loading : SignUpState()
    data class Success(val data: SignUpResponse) : SignUpState()
    data class Error(val message: String) : SignUpState()
}

data class SearchUiState(
    val inputText: String = "",
    val submittedQuery: String? = null,
    val results: List<Product> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val hasSearched: Boolean = false,
    val lastSuccessfulQuery: String? = null
)

sealed interface ProductDetailUiState {
    data object Loading : ProductDetailUiState
    data class Success(val product: Product) : ProductDetailUiState
    data class Error(val message: String, val canRetry: Boolean = true) : ProductDetailUiState
}
