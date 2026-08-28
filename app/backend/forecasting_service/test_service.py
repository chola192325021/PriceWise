import unittest
import json
from app import app, preprocess_series, generate_statistical_forecast

class TestChronosForecastingService(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_preprocess_series_validation_and_deduplication(self):
        raw_points = [
            {"timestamp": "2026-08-01T10:00:00Z", "price": 50000},
            {"timestamp": "2026-08-01T15:00:00Z", "price": 49000}, # Intraday lower price
            {"timestamp": "2026-08-02T10:00:00Z", "price": -100},  # Invalid price
            {"timestamp": "2026-08-03T10:00:00Z", "price": 48500},
        ]
        processed = preprocess_series(raw_points)
        self.assertEqual(len(processed), 3) # Aug 1, Aug 2 (resampled fill), Aug 3
        self.assertEqual(processed[0]["price"], 49000)

    def test_statistical_forecast_generation(self):
        prices = [50000, 49500, 49000, 48500, 48000, 47500, 47000]
        points, trend, confidence = generate_statistical_forecast(prices, horizon=14)
        self.assertEqual(len(points), 14)
        self.assertEqual(trend, "likely_decrease")
        self.assertTrue(points[0]["lowerBound"] <= points[0]["predictedPrice"] <= points[0]["upperBound"])

    def test_forecast_api_endpoint(self):
        payload = {
            "productId": "test_prod_1",
            "sourceId": "Amazon",
            "currency": "INR",
            "horizon": 14,
            "points": [
                {"date": "2026-08-10", "price": 60000},
                {"date": "2026-08-11", "price": 59500},
                {"date": "2026-08-12", "price": 59000},
                {"date": "2026-08-13", "price": 58500},
                {"date": "2026-08-14", "price": 58000},
                {"date": "2026-08-15", "price": 57500},
                {"date": "2026-08-16", "price": 57000}
            ]
        }
        res = self.app.post("/forecast", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["horizon"], 14)
        self.assertEqual(len(data["forecast"]), 14)
        self.assertTrue("predictedPrice" in data["forecast"][0])

if __name__ == "__main__":
    unittest.main()
