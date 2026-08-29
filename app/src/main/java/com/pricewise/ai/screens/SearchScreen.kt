package com.pricewise.ai.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pricewise.ui.theme.PriceWisePrimary
import com.pricewise.ai.components.AiProductCard
import com.pricewise.ai.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    viewModel: AuthViewModel,
    onBackPressed: () -> Unit = {},
    onProductClick: (String) -> Unit = {}
) {
    val searchUiState by viewModel.searchUiState.collectAsState()
    val homeProducts by viewModel.products.collectAsState()

    val inputText = searchUiState.inputText
    val hasSearched = searchUiState.hasSearched
    val isSearching = searchUiState.isLoading
    val searchResults = searchUiState.results
    val searchError = searchUiState.error

    val displayProducts = if (hasSearched) searchResults else homeProducts

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { newText ->
                            // Update input text only; zero network requests
                            viewModel.updateSearchInput(newText)
                        },
                        placeholder = { Text("Search on Amazon, Flipkart, Meesho, AJIO...") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(end = 8.dp),
                        leadingIcon = {
                            IconButton(onClick = {
                                val query = inputText.trim()
                                if (query.isNotEmpty()) {
                                    viewModel.submitSearch(query, cause = "USER_SUBMIT")
                                }
                            }) {
                                Icon(Icons.Default.Search, contentDescription = "Search", tint = PriceWisePrimary)
                            }
                        },
                        trailingIcon = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (inputText.isNotEmpty()) {
                                    IconButton(onClick = { 
                                        viewModel.clearSearchInput()
                                    }) {
                                        Icon(Icons.Default.Close, contentDescription = "Clear input")
                                    }
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PriceWisePrimary,
                            unfocusedBorderColor = Color.LightGray
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            val query = inputText.trim()
                            if (query.isNotEmpty()) {
                                viewModel.submitSearch(query, cause = "USER_SUBMIT")
                            }
                        })
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding).padding(horizontal = 16.dp)) {
            if (isSearching) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = PriceWisePrimary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Searching live across Amazon, Flipkart, Meesho, AJIO, Myntra...", color = Color.Gray)
                    }
                }
            } else if (searchError != null && hasSearched) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(searchError, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val query = searchUiState.submittedQuery ?: inputText.trim()
                                if (query.isNotEmpty()) {
                                    viewModel.submitSearch(query, cause = "USER_RETRY", forceRefresh = true)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = PriceWisePrimary)
                        ) {
                            Text("Retry Search")
                        }
                    }
                }
            } else if (hasSearched && displayProducts.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No products found for \"${searchUiState.submittedQuery ?: inputText}\"", color = Color.Gray)
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = {
                                val query = searchUiState.submittedQuery ?: inputText.trim()
                                if (query.isNotEmpty()) {
                                    viewModel.submitSearch(query, cause = "USER_REFRESH", forceRefresh = true)
                                }
                            }
                        ) {
                            Text("Refresh Search")
                        }
                    }
                }
            } else {
                if (!hasSearched) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Trending Deals & Popular Products",
                        style = MaterialTheme.typography.titleMedium,
                        color = PriceWisePrimary
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                } else {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Results for \"${searchUiState.submittedQuery ?: inputText}\" (${displayProducts.size})",
                            style = MaterialTheme.typography.titleSmall,
                            color = PriceWisePrimary
                        )
                        TextButton(
                            onClick = {
                                val query = searchUiState.submittedQuery ?: inputText.trim()
                                if (query.isNotEmpty()) {
                                    viewModel.submitSearch(query, cause = "USER_REFRESH", forceRefresh = true)
                                }
                            }
                        ) {
                            Text("Refresh", fontSize = 12.sp, color = PriceWisePrimary)
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                LazyColumn {
                    items(displayProducts) { product ->
                        Box(modifier = Modifier.clickable { onProductClick(product.id) }) {
                            AiProductCard(product)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}
