package com.pricewise.ai.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pricewise.ai.components.AiProductCard
import com.pricewise.ai.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlertsScreen(
    viewModel: AuthViewModel,
    onNavigate: (String) -> Unit,
    onProductClick: (String) -> Unit
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val products by viewModel.products.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val fetchedUserAlerts by viewModel.userAlerts.collectAsState()

    LaunchedEffect(currentUser) {
        if (currentUser != null) {
            viewModel.fetchUserAlerts()
        }
    }

    val userAlerts = currentUser?.alerts ?: emptyList()
    
    val alertProducts = remember(fetchedUserAlerts, userAlerts, products, searchResults) {
        if (fetchedUserAlerts.isNotEmpty()) {
            fetchedUserAlerts.map { Pair(it.product, it.targetPrice) }
        } else {
            userAlerts.mapNotNull { alert ->
                val product = viewModel.getProductById(alert.productId) ?: (products + searchResults).find { it.id == alert.productId }
                if (product != null) Pair(product, alert.targetPrice) else null
            }.distinctBy { it.first.id }
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
                title = { Text("Price Alerts", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) }
            )
        },
        bottomBar = {
            BottomNavigationBar(currentRoute = "alerts", onNavigate = onNavigate)
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .padding(horizontal = 16.dp)
        ) {
            if (alertProducts.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.NotificationsNone, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("No price alerts set.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    contentPadding = PaddingValues(bottom = 16.dp, top = 8.dp)
                ) {
                    items(alertProducts) { (product, targetPrice) ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                                contentColor = MaterialTheme.colorScheme.onSurface
                            )
                        ) {
                            Column {
                                Box(modifier = Modifier.clickable { onProductClick(product.id) }) {
                                    AiProductCard(product)
                                }
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "Target Price: ₹${targetPrice.toInt()}",
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    TextButton(onClick = { viewModel.removePriceAlert(product.id) }) {
                                        Text("Remove Alert", color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
