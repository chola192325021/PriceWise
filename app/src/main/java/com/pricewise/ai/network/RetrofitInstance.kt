package com.pricewise.ai.network

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

import android.util.Log

object RetrofitInstance {
    private const val BASE_URL = "http://10.108.38.180:5000/"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request()
            Log.d("RetrofitInstance", "Sending request ${request.method} ${request.url}")
            try {
                val response = chain.proceed(request)
                Log.d("RetrofitInstance", "Received response ${response.code} for ${response.request.url}")
                response
            } catch (e: Exception) {
                Log.e("RetrofitInstance", "HTTP request failed for ${request.url}: ${e.message}", e)
                throw e
            }
        }
        .build()

    val api: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
