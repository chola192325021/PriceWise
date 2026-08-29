package com.pricewise.ai.model

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    @SerializedName("status")
    val status: String?,
    @SerializedName("message")
    val message: String?,
    @SerializedName("token")
    val token: String?,
    @SerializedName("user")
    val user: User?
)

fun versionedProfileUrl(url: String?, version: String?): String? {
    if (url.isNullOrBlank()) return null
    if (url.startsWith("data:", ignoreCase = true) || (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true))) {
        return url
    }
    val separator = if (url.contains("?")) "&" else "?"
    return "$url${separator}v=${version ?: "default"}"
}

data class User(
    @SerializedName("id")
    val id: String?,
    @SerializedName("email")
    val email: String?,
    @SerializedName("name")
    val name: String?,
    @SerializedName("profilePhoto")
    val profilePhoto: String? = null,
    @SerializedName("profilePhotoUrl")
    val profilePhotoUrl: String? = null,
    @SerializedName("profile_photo")
    val profile_photo: String? = null,
    @SerializedName("photoVersion")
    val photoVersion: String? = null,
    @SerializedName("memberSince")
    val memberSince: String?,
    @SerializedName("watchlist")
    val watchlist: List<String>? = emptyList(),
    @SerializedName("alerts")
    val alerts: List<AlertItem>? = emptyList()
) {
    val photoUrl: String
        get() {
            val base = profilePhotoUrl?.takeIf { it.isNotBlank() }
                ?: profilePhoto?.takeIf { it.isNotBlank() }
                ?: profile_photo?.takeIf { it.isNotBlank() }
                ?: return ""
            return versionedProfileUrl(base, photoVersion) ?: ""
        }
}

data class AlertItem(
    @SerializedName("productId")
    val productId: String,
    @SerializedName("targetPrice")
    val targetPrice: Double
)
