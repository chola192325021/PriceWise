package com.example.pricewise

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.pricewise.ai.screens.*
import com.example.pricewise.ui.theme.PriceWiseTheme
import com.pricewise.ai.viewmodel.AuthViewModel

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val authViewModel: AuthViewModel = viewModel()
            val isDarkThemeState by authViewModel.isDarkTheme.collectAsState()
            val darkTheme = isDarkThemeState ?: isSystemInDarkTheme()

            PriceWiseTheme(darkTheme = darkTheme) {
                PriceWiseApp(authViewModel)
            }
        }
    }
}

@Composable
fun PriceWiseApp(authViewModel: AuthViewModel = viewModel()) {
    val navController = rememberNavController()
    val chatViewModel: com.pricewise.ai.viewmodel.ChatViewModel = viewModel()

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                viewModel = authViewModel,
                onSignUpClick = {
                    authViewModel.resetStates()
                    navController.navigate("signup")
                },
                onLoginSuccess = {
                    navController.navigate("home") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }
        composable("signup") {
            SignUpScreen(
                viewModel = authViewModel,
                onLoginClick = {
                    authViewModel.resetStates()
                    navController.navigate("login")
                },
                onBackPressed = {
                    navController.popBackStack()
                },
                onSignUpSuccess = {
                    navController.navigate("home") {
                        popUpTo("signup") { inclusive = true }
                    }
                }
            )
        }
        composable("home") {
            HomeScreen(
                viewModel = authViewModel,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo("home") { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onSearchClick = {
                    navController.navigate("search")
                },
                onProductClick = { productId ->
                    navController.navigate("productDetail/$productId")
                }
            )
        }
        composable("search") {
            SearchScreen(
                viewModel = authViewModel,
                onBackPressed = {
                    navController.popBackStack()
                },
                onProductClick = { productId ->
                    navController.navigate("productDetail/$productId")
                }
            )
        }
        composable("productDetail/{productId}") { backStackEntry ->
            val productId = backStackEntry.arguments?.getString("productId") ?: ""
            ProductDetailScreen(
                productId = productId,
                viewModel = authViewModel,
                onBackPressed = {
                    navController.popBackStack()
                },
                onSetAlertClick = {
                    navController.navigate("priceAlert/$productId")
                }
            )
        }
        composable("priceAlert/{productId}") { backStackEntry ->
            val productId = backStackEntry.arguments?.getString("productId") ?: ""
            PriceAlertScreen(
                productId = productId,
                viewModel = authViewModel,
                onBackPressed = {
                    navController.popBackStack()
                }
            )
        }
        composable("chatbot") {
            ChatbotScreen(
                userId = authViewModel.currentUser.value?.id ?: "",
                viewModel = chatViewModel,
                onBackPressed = {
                    navController.popBackStack()
                },
                onNavigateToRoute = { route ->
                    when (route) {
                        "LOGIN" -> navController.navigate("login")
                        "FORGOT_PASSWORD" -> navController.navigate("login")
                        "SEARCH" -> navController.navigate("search")
                        "WATCHLIST" -> navController.navigate("watchlist")
                        "PRICE_ALERT_HELP", "NOTIFICATIONS_SETTINGS" -> navController.navigate("alerts")
                        "SUPPORT" -> navController.navigate("profile")
                        else -> navController.navigate("home")
                    }
                }
            )
        }
        composable("watchlist") {
            WatchlistScreen(
                viewModel = authViewModel,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo("home") { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onProductClick = { productId ->
                    navController.navigate("productDetail/$productId")
                }
            )
        }
        composable("alerts") {
            AlertsScreen(
                viewModel = authViewModel,
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo("home") { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onProductClick = { productId ->
                    navController.navigate("productDetail/$productId")
                }
            )
        }
        composable("profile") {
            ProfileScreen(
                viewModel = authViewModel,
                onLogoutClick = {
                    authViewModel.logout()
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigate = { route ->
                    navController.navigate(route) {
                        popUpTo("home") { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                onSearchClick = {
                    navController.navigate("search")
                }
            )
        }
    }
}
