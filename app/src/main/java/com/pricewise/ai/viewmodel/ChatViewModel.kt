package com.pricewise.ai.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.pricewise.ai.model.ChatMessage
import com.pricewise.ai.utils.FaqEngine
import com.pricewise.ai.utils.FaqMatchResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class UiChatMessage(
    val id: String,
    val role: String,
    val content: String,
    val matchResult: FaqMatchResult? = null
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val faqEngine = FaqEngine(application)

    private val _messages = MutableStateFlow<List<UiChatMessage>>(emptyList())
    val messages: StateFlow<List<UiChatMessage>> = _messages

    private val _categories = MutableStateFlow<List<String>>(emptyList())
    val categories: StateFlow<List<String>> = _categories

    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory

    init {
        _categories.value = listOf("All") + faqEngine.getAllCategories()
        _messages.value = listOf(
            UiChatMessage(
                id = "welcome_1",
                role = "assistant",
                content = "Welcome to the PriceWise Help Center & FAQ Assistant! Select a topic or ask any question about price tracking, stores, alerts, or predictions."
            )
        )
    }

    fun sendMessage(content: String, userId: String? = null) {
        val trimmed = content.trim()
        if (trimmed.isEmpty()) return

        val userMsg = UiChatMessage(
            id = "user_${System.currentTimeMillis()}",
            role = "user",
            content = trimmed
        )

        val matchResult = faqEngine.matchFaq(trimmed)

        val assistantMsg = UiChatMessage(
            id = "assistant_${System.currentTimeMillis()}",
            role = "assistant",
            content = matchResult.answer,
            matchResult = matchResult
        )

        _messages.value = _messages.value + userMsg + assistantMsg
    }

    fun selectCategory(category: String) {
        _selectedCategory.value = category
    }

    fun getQuestionsForCategory(category: String): List<String> {
        return if (category == "All") {
            faqEngine.getSuggestedQuestions()
        } else {
            faqEngine.getFaqsByCategory(category).map { it.question }
        }
    }

    fun clearChat() {
        _messages.value = listOf(
            UiChatMessage(
                id = "welcome_${System.currentTimeMillis()}",
                role = "assistant",
                content = "Chat cleared. Select a suggested topic below or ask any question about PriceWise features."
            )
        )
    }
}
