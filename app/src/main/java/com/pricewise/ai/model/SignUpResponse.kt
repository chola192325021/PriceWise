package com.pricewise.ai.model

data class SignUpResponse(
    val status: String,
    val message: String,
    val token: String?,
    val user: UserData?
)

data class UserData(
    val id: String,
    val email: String,
    val name: String,
    val profilePhoto: String?,
    val memberSince: String?
)