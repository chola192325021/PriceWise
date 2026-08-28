package com.pricewise.ai.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pricewise.ui.theme.PriceWisePrimary
import com.pricewise.ai.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PriceAlertScreen(
    productId: String,
    viewModel: AuthViewModel,
    onBackPressed: () -> Unit = {}
) {
    val products by viewModel.products.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val product = remember(productId, products, searchResults) {
        viewModel.getProductById(productId) ?: (products + searchResults).find { it.id == productId }
    }

    val smartDeal = product?.platforms?.find { it.isSmartDeal } ?: product?.platforms?.firstOrNull()
    val currentLowestPrice = smartDeal?.price?.toFloat() ?: 5000f

    var targetPrice by remember(currentLowestPrice) { mutableStateOf(currentLowestPrice * 0.9f) }
    var showSuccessDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Set Price Alert", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        bottomBar = {
            Button(
                onClick = {
                    viewModel.setPriceAlert(productId, targetPrice.toDouble())
                    showSuccessDialog = true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PriceWisePrimary)
            ) {
                Text("Confirm Alert", fontWeight = FontWeight.Bold)
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
                .fillMaxSize()
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = product?.title ?: "Product",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text("Notify me when the price drops below your target.", color = Color.Gray, fontSize = 13.sp)

            Spacer(modifier = Modifier.height(24.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Current Lowest Price", fontWeight = FontWeight.Bold)
                    Text("₹${currentLowestPrice.toInt()}", fontWeight = FontWeight.Bold, color = PriceWisePrimary, fontSize = 18.sp)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text("Your Target Price: ₹${targetPrice.toInt()}", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = PriceWisePrimary)
            Spacer(modifier = Modifier.height(16.dp))
            
            val maxRange = if (currentLowestPrice > 0f) currentLowestPrice else 10000f
            Slider(
                value = targetPrice.coerceIn(0f, maxRange),
                onValueChange = { targetPrice = it },
                valueRange = 0f..maxRange,
                colors = SliderDefaults.colors(
                    thumbColor = PriceWisePrimary,
                    activeTrackColor = PriceWisePrimary
                )
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("₹0", color = Color.Gray, fontSize = 12.sp)
                Text("₹${maxRange.toInt()}", color = Color.Gray, fontSize = 12.sp)
            }

            if (showSuccessDialog) {
                AlertDialog(
                    onDismissRequest = { 
                        showSuccessDialog = false
                        onBackPressed()
                    },
                    icon = { Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PriceWisePrimary, modifier = Modifier.size(48.dp)) },
                    title = { Text("Alert Set Successfully!") },
                    text = { Text("We will notify you when the price drops below ₹${targetPrice.toInt()}.") },
                    confirmButton = {
                        TextButton(onClick = { 
                            showSuccessDialog = false
                            onBackPressed()
                        }) {
                            Text("OK", color = PriceWisePrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                )
            }
        }
    }
}
