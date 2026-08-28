package com.pricewise.ai.model

data class ChatMessage(
    val role: String,
    val content: String
)

data class ChatRequest(
    val userId: String,
    val messages: List<ChatMessage>
)

data class ChatResponse(
    val status: String,
    val reply: String?,
    val message: String?
)
