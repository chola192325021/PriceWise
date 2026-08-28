package com.pricewise.ai.model

import com.google.gson.annotations.SerializedName

data class SignUpResponse(
    @SerializedName("status")
    val status: String,
    @SerializedName("message")
    val message: String?,
    @SerializedName("token")
    val token: String?,
    @SerializedName("user")
    val user: UserData?
)

data class UserData(
    @SerializedName("id")
    val id: String,
    @SerializedName("email")
    val email: String,
    @SerializedName("name")
    val name: String,
    @SerializedName("profilePhoto")
    val profilePhoto: String? = null,
    @SerializedName("profilePhotoUrl")
    val profilePhotoUrl: String? = null,
    @SerializedName("profile_photo")
    val profile_photo: String? = null,
    @SerializedName("memberSince")
    val memberSince: String? = null
) {
    val photoUrl: String
        get() = profilePhotoUrl?.takeIf { it.isNotBlank() }
            ?: profilePhoto?.takeIf { it.isNotBlank() }
            ?: profile_photo?.takeIf { it.isNotBlank() }
            ?: ""
}