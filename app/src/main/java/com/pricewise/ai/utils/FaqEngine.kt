package com.pricewise.ai.utils

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

data class RelatedAction(
    val type: String,
    val route: String,
    val label: String
)

data class FaqItem(
    val id: String,
    val category: String,
    val question: String,
    val answer: String,
    val keywords: List<String>,
    val aliases: List<String>? = null,
    val relatedActions: List<RelatedAction>? = null,
    val relatedFaqIds: List<String>? = null
)

data class FaqMatchResult(
    val matched: Boolean,
    val faqId: String? = null,
    val category: String? = null,
    val answer: String,
    val confidence: String,
    val score: Int,
    val relatedActions: List<RelatedAction> = emptyList(),
    val relatedFaqIds: List<String> = emptyList()
)

class FaqEngine(private val context: Context) {
    private val faqList: List<FaqItem> by lazy {
        try {
            val jsonString = context.assets.open("faq.json").bufferedReader().use { it.readText() }
            val listType = object : TypeToken<List<FaqItem>>() {}.type
            Gson().fromJson(jsonString, listType) ?: emptyList()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun normalizeText(text: String): String {
        return text.lowercase()
            .replace("-", " ")
            .replace(Regex("[^a-zA-Z0-9\\s]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    fun matchFaq(userQuery: String): FaqMatchResult {
        val norm = normalizeText(userQuery)
        val defaultFallback = "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support."

        if (norm.isBlank()) {
            return FaqMatchResult(
                matched = false,
                answer = defaultFallback,
                confidence = "none",
                score = 0
            )
        }

        var bestMatch: FaqItem? = null
        var highestScore = 0

        for (faq in faqList) {
            var score = 0
            val normQ = normalizeText(faq.question)

            if (norm == normQ) {
                score = 100
            } else if (faq.aliases?.any { alias ->
                    val normA = normalizeText(alias)
                    norm == normA || norm.contains(normA) || normA.contains(norm)
                } == true) {
                score = 90
            } else if (normQ.contains(norm) || norm.contains(normQ)) {
                score = 75
            } else if (!faq.keywords.isNullOrEmpty()) {
                val queryWords = norm.split(" ")
                var matchCount = 0
                for (kw in faq.keywords) {
                    val normKw = normalizeText(kw)
                    if (queryWords.any { it == normKw || (it.length > 3 && normKw.contains(it)) }) {
                        matchCount++
                    }
                }
                if (matchCount > 0) {
                    score = minOf(70, ((matchCount.toDouble() / queryWords.size) * 50 + (matchCount.toDouble() / faq.keywords.size) * 20).toInt())
                }
            }

            if (score > highestScore) {
                highestScore = score
                bestMatch = faq
            }
        }

        if (bestMatch != null && highestScore >= 35) {
            val confLabel = when {
                highestScore >= 90 -> "exact"
                highestScore >= 75 -> "high"
                highestScore >= 50 -> "medium"
                else -> "low"
            }

            return FaqMatchResult(
                matched = true,
                faqId = bestMatch.id,
                category = bestMatch.category,
                answer = bestMatch.answer,
                confidence = confLabel,
                score = highestScore,
                relatedActions = bestMatch.relatedActions ?: emptyList(),
                relatedFaqIds = bestMatch.relatedFaqIds ?: emptyList()
            )
        }

        return FaqMatchResult(
            matched = false,
            answer = defaultFallback,
            confidence = "none",
            score = highestScore
        )
    }

    fun getAllCategories(): List<String> {
        return faqList.map { it.category }.distinct()
    }

    fun getFaqsByCategory(category: String): List<FaqItem> {
        return faqList.filter { it.category == category }
    }

    fun getSuggestedQuestions(): List<String> {
        return faqList.take(4).map { it.question }
    }
}
