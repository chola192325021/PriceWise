package com.pricewise.ai.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.pricewise.ui.theme.PriceWisePrimary
import com.pricewise.ai.model.Product
import com.pricewise.ai.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    viewModel: AuthViewModel,
    onBackPressed: () -> Unit = {},
    onSetAlertClick: () -> Unit = {}
) {
    val products by viewModel.products.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val product = viewModel.getProductById(productId) ?: (products + searchResults).find { it.id == productId }

    if (product == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
        return
    }

    val displayTitle = product.cleanTitle ?: product.title
    val eligiblePlatforms = product.platforms.filter { it.comparisonEligible != false }
    val smartDeal = eligiblePlatforms.find { it.isSmartDeal } ?: eligiblePlatforms.firstOrNull() ?: product.platforms.first()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = MaterialTheme.colorScheme.onBackground,
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                ),
                title = { Text("PriceWise", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    IconButton(onClick = onBackPressed) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onBackground)
                    }
                },
                actions = {
                    val currentUser by viewModel.currentUser.collectAsState()
                    val isInWatchlist = currentUser?.watchlist?.contains(productId) == true
                    
                    IconButton(onClick = {
                        if (isInWatchlist) {
                            viewModel.removeFromWatchlist(productId)
                        } else {
                            viewModel.addToWatchlist(productId)
                        }
                    }) {
                        Icon(
                            if (isInWatchlist) Icons.Default.Favorite else Icons.Default.FavoriteBorder, 
                            contentDescription = "Watchlist",
                            tint = if (isInWatchlist) Color.Red else MaterialTheme.colorScheme.onBackground
                        )
                    }
                }
            )
        },
        bottomBar = {
            Button(
                onClick = onSetAlertClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            ) {
                Icon(Icons.Outlined.Notifications, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Set Price Alert", fontWeight = FontWeight.Bold)
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            // Product Image
            Box(modifier = Modifier.fillMaxWidth().height(300.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surface)) {
                AsyncImage(
                    model = product.imageUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.padding(12.dp).align(Alignment.TopEnd)
                ) {
                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Smart Choice", color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Title and Price
            Text(displayTitle, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("₹${smartDeal.price}", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Text("₹${smartDeal.price * 1.1}", style = MaterialTheme.typography.bodyMedium.copy(textDecoration = TextDecoration.LineThrough), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.width(8.dp))
                Text("10% OFF", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(24.dp))

            // AI Verdict Card
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(16.dp)) {
                    Box(modifier = Modifier.size(40.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.AccessTime, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("AI VERDICT", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(color = MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(4.dp)) {
                                Text("HIGH CONFIDENCE", color = MaterialTheme.colorScheme.onPrimary, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                            }
                        }
                        val predictionText = if (product.aiPrediction.trend == "drop") "WAIT - Price predicted to drop" else "BUY NOW - Price is stable"
                        Text(predictionText, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
                        Text(
                            product.aiPrediction.recommendation,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Amazon Chronos AI Forecast Card
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Timeline, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("AMAZON CHRONOS FORECAST", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("14-Day Probabilistic Estimate", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Zero-shot time-series trajectory with upper & lower confidence bands. Estimates are non-guaranteed predictions.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Exact Matches Section
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Exact Matches (${eligiblePlatforms.size})", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
                Text("Identical Product", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
            }
            Spacer(modifier = Modifier.height(12.dp))

            // Comparison quality banner
            product.comparisonSummary?.let { summary ->
                ComparisonSummaryBanner(summary = summary)
                Spacer(modifier = Modifier.height(8.dp))
            }

            product.noExactMatchMessage?.let { msg ->
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(msg, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            eligiblePlatforms.forEach { platform ->
                PlatformRow(platform = platform, productTitle = displayTitle)
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Similar Products Section (if any)
            if (!product.similarProducts.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Similar Products (${product.similarProducts.size})", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = RoundedCornerShape(50)
                    ) {
                        Text("Not in exact comparison", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Comparable alternatives and variants from verified stores.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))

                product.similarProducts.forEach { sim ->
                    SimilarProductRow(sim = sim)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            Spacer(modifier = Modifier.height(80.dp)) // Padding for bottom button
        }
    }
}

@Composable
fun ComparisonSummaryBanner(summary: com.pricewise.ai.model.ComparisonSummary) {
    val (containerColor, textColor, icon, mainText) = when (summary.comparisonType) {
        "exact_match" -> listOf(
            MaterialTheme.colorScheme.tertiaryContainer,
            MaterialTheme.colorScheme.onTertiaryContainer,
            Icons.Default.CheckCircle,
            "Exact match confirmed across all stores"
        )
        "variant_match" -> listOf(
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer,
            Icons.Default.Warning,
            "Similar variant — not an identical product"
        )
        "unit_price_only" -> listOf(
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.onSurfaceVariant,
            Icons.Default.Info,
            "Comparable product — different pack/quantity"
        )
        else -> listOf(
            MaterialTheme.colorScheme.errorContainer,
            MaterialTheme.colorScheme.onErrorContainer,
            Icons.Default.Error,
            "No exact match found on other stores"
        )
    }

    Surface(
        color = containerColor as Color,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = icon as androidx.compose.ui.graphics.vector.ImageVector,
                contentDescription = null,
                tint = textColor as Color,
                modifier = Modifier.size(16.dp).padding(top = 1.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    mainText as String,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = textColor
                )
                summary.comparisonWarning?.let { warning ->
                    Text(
                        warning,
                        fontSize = 11.sp,
                        color = textColor,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
                summary.unitPriceLabel?.let { label ->
                    Text(
                        "Prices shown per unit ($label)",
                        fontSize = 11.sp,
                        color = textColor,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun MatchStatusChip(matchStatus: String?) {
    if (matchStatus == null || matchStatus == "reference") {
        Text("Reference listing", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    val (chipColor, chipText) = when (matchStatus) {
        "exact_match" -> Pair(MaterialTheme.colorScheme.tertiaryContainer, "✓ Exact match")
        "variant_match" -> Pair(MaterialTheme.colorScheme.secondaryContainer, "⚠ Similar variant")
        "unit_price_only" -> Pair(MaterialTheme.colorScheme.surfaceVariant, "↔ Different quantity")
        "no_match" -> Pair(MaterialTheme.colorScheme.errorContainer, "✕ No exact match")
        else -> Pair(MaterialTheme.colorScheme.surfaceVariant, matchStatus)
    }
    val chipTextColor = when (matchStatus) {
        "exact_match" -> MaterialTheme.colorScheme.onTertiaryContainer
        "variant_match" -> MaterialTheme.colorScheme.onSecondaryContainer
        "no_match" -> MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        color = chipColor,
        shape = RoundedCornerShape(50),
    ) {
        Text(
            chipText,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = chipTextColor,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun PlatformRow(platform: com.pricewise.ai.model.Platform, productTitle: String = "") {
    val context = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                try {
                    val rawUrl = platform.url
                    val validUrl = if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) rawUrl else "https://$rawUrl"
                    val uri = Uri.parse(validUrl)
                    var opened = false

                    // Try launching store app if available
                    val appPackage = when {
                        platform.name.equals("Flipkart", ignoreCase = true) -> "com.flipkart.android"
                        platform.name.equals("Meesho", ignoreCase = true) -> "com.meesho.supply"
                        platform.name.equals("Amazon", ignoreCase = true) -> "in.amazon.mShop.android.shopping"
                        platform.name.equals("AJIO", ignoreCase = true) -> "com.ril.ajio"
                        platform.name.equals("Myntra", ignoreCase = true) -> "com.myntra.android"
                        else -> null
                    }

                    if (appPackage != null) {
                        try {
                            val appIntent = Intent(Intent.ACTION_VIEW, uri).apply { setPackage(appPackage) }
                            context.startActivity(appIntent)
                            opened = true
                        } catch (_: Exception) {}
                    }

                    if (!opened) {
                        try {
                            val browserIntent = Intent(Intent.ACTION_VIEW, uri)
                            context.startActivity(browserIntent)
                        } catch (e2: Exception) {
                            android.widget.Toast.makeText(context, "Cannot open link: ${platform.name}", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    android.widget.Toast.makeText(context, "Cannot open link: ${platform.name}", android.widget.Toast.LENGTH_SHORT).show()
                }
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(40.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(platform.name.take(1), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(platform.name, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                // Show the actual listing title if it differs from the product title
                val listingTitle = platform.productTitle
                if (!listingTitle.isNullOrBlank() && listingTitle != productTitle) {
                    Text(
                        "Listed as: ${listingTitle.take(60)}${if (listingTitle.length > 60) "…" else ""}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 1.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                MatchStatusChip(matchStatus = platform.matchStatus)
                // Show differing attributes if any
                val diffAttrs = platform.differingAttributes
                if (!diffAttrs.isNullOrEmpty()) {
                    Text(
                        "Differs: ${diffAttrs.joinToString(", ") { it.replace(Regex("([A-Z])"), " $1").trim() }}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("₹${platform.price.toLong()}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                // Show unit price for unit_price_only matches
                if (platform.matchStatus == "unit_price_only" && platform.unitPriceB != null && platform.unitLabel != null) {
                    Text(
                        "₹${platform.unitPriceB} ${platform.unitLabel}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun SimilarProductRow(sim: com.pricewise.ai.model.SimilarProduct) {
    val context = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                try {
                    val rawUrl = sim.url
                    val validUrl = if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) rawUrl else "https://$rawUrl"
                    val uri = Uri.parse(validUrl)
                    val browserIntent = Intent(Intent.ACTION_VIEW, uri)
                    context.startActivity(browserIntent)
                } catch (e: Exception) {
                    android.widget.Toast.makeText(context, "Cannot open link: ${sim.source}", android.widget.Toast.LENGTH_SHORT).show()
                }
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(40.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(sim.source.take(1), fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(sim.source, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    val tierLabel = if (sim.similarityTier == "close_variant") "Similar Variant" else "Comparable Alternative"
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            tierLabel,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                Text(
                    sim.title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 2.dp)
                )
                val diffs = sim.differences
                if (!diffs.isNullOrEmpty()) {
                    Text(
                        diffs.first(),
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("₹${sim.price.toLong()}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
