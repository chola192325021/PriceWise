package com.pricewise.ai.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pricewise.ai.components.AiProductCard
import com.pricewise.ai.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchlistScreen(
    viewModel: AuthViewModel,
    onNavigate: (String) -> Unit,
    onProductClick: (String) -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val products by viewModel.products.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val fetchedUserWatchlist by viewModel.userWatchlist.collectAsState()

    LaunchedEffect(currentUser) {
        if (currentUser != null) {
            viewModel.fetchUserWatchlist()
        }
    }

    val watchlistProductIds = currentUser?.watchlist ?: emptyList()
    val watchlistProducts = remember(fetchedUserWatchlist, watchlistProductIds, products, searchResults) {
        if (fetchedUserWatchlist.isNotEmpty()) {
            fetchedUserWatchlist
        } else {
            (products + searchResults).filter { it.id in watchlistProductIds }.distinctBy { it.id }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = MaterialTheme.colorScheme.onBackground,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                ),
                title = { Text("My Watchlist", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                actions = {
                    IconButton(onClick = { 
                        viewModel.refreshWatchlist()
                    }) {
                        Icon(Icons.Default.Sync, contentDescription = "Refresh", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        },
        bottomBar = {
            BottomNavigationBar(currentRoute = "watchlist", onNavigate = onNavigate)
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            if (watchlistProducts.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.BookmarkBorder, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Your watchlist is empty.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(bottom = 16.dp, top = 8.dp)
                ) {
                    items(watchlistProducts) { product ->
                        Box(modifier = Modifier.clickable { onProductClick(product.id) }) {
                            AiProductCard(product)
                        }
                    }
                }
            }
        }
    }
}
