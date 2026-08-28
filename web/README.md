# PriceWise Web

A responsive React frontend for the PriceWise AI price tracking application. This website shares the same backend, database, and authentication system as the PriceWise Android app.

## Requirements

- Node.js (v18+)
- npm or yarn
- Access to the PriceWise Node.js Backend

## Environment Variables

Create a `.env` file in the `web/` directory with the following variables:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_API_BASE_URL=http://localhost:5000
```

*Note: Never expose `SERVICE_ROLE_KEY` or scraper secrets in these frontend environment variables.*

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run locally:**
   ```bash
   npm run dev
   ```
   The site will be available at `http://localhost:3000`.

3. **Build for production:**
   ```bash
   npm run build
   ```

## Feature Parity & Shared Data

PriceWise Web is designed to be a first-class companion to the Android app:

- **Shared Auth:** Uses the same Node.js backend authentication flow. Users can log in with the same credentials across both platforms.
- **Shared Watchlist:** Changes made to your watchlist on web are immediately visible on Android and vice-versa, as both clients communicate with the same Supabase database.
- **Real-time Data:** Leverages the same product scraping and AI prediction engine hosted on the Node.js backend.
- **Price History:** Displays the exact same historical data points collected by the backend's nightly and live scrapers.

## Security Warning

This frontend only requires the **Anon/Public Key** for Supabase. DO NOT add the `SERVICE_ROLE_KEY` to this directory or its `.env` files, as it bypasses Row Level Security (RLS) and would be exposed to the browser.
