package com.pricewise.ai.model

data class SignUpRequest(
    val name: String,
    val email: String,
    val password: String
)