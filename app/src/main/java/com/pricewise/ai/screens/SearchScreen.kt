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
    var searchQuery by remember { mutableStateOf("") }
    val searchProducts by viewModel.searchResults.collectAsState()
    val homeProducts by viewModel.products.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()

    val displayProducts = if (searchQuery.isEmpty()) homeProducts else searchProducts

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { 
                            searchQuery = it
                            if (it.isNotEmpty()) {
                                viewModel.fetchProducts(it)
                            }
                        },
                        placeholder = { Text("Search on Amazon, Flipkart, Meesho, AJIO...") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(end = 16.dp),
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { 
                                    searchQuery = "" 
                                }) {
                                    Icon(Icons.Default.Close, contentDescription = null)
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
                            if (searchQuery.isNotEmpty()) {
                                viewModel.fetchProducts(searchQuery)
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
            } else if (displayProducts.isEmpty() && searchQuery.isNotEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No products found for \"$searchQuery\"", color = Color.Gray)
                }
            } else {
                if (searchQuery.isEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Trending Deals & Popular Products",
                        style = MaterialTheme.typography.titleMedium,
                        color = PriceWisePrimary
                    )
                    Spacer(modifier = Modifier.height(12.dp))
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
