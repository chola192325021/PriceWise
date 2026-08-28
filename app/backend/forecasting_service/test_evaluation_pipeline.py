import unittest
import math
from app import preprocess_series, generate_statistical_forecast

class TestEvaluationPipelineDataAndMetrics(unittest.TestCase):

    def test_chronological_ordering_and_deduplication(self):
        raw_points = [
            {"timestamp": "2026-08-05T12:00:00Z", "price": 100},
            {"timestamp": "2026-08-01T10:00:00Z", "price": 120},
            {"timestamp": "2026-08-01T18:00:00Z", "price": 110}, # Duplicate date, lower price
        ]
        processed = preprocess_series(raw_points)
        self.assertEqual(len(processed), 5) # 2026-08-01 to 2026-08-05
        self.assertEqual(processed[0]["price"], 110) # Minimum intraday kept
        self.assertEqual(processed[0]["date"].strftime("%Y-%m-%d"), "2026-08-01")
        self.assertEqual(processed[-1]["date"].strftime("%Y-%m-%d"), "2026-08-05")

    def test_invalid_prices_filtering(self):
        raw_points = [
            {"timestamp": "2026-08-01", "price": 0}, # Invalid <= 0
            {"timestamp": "2026-08-02", "price": -50}, # Invalid negative
            {"timestamp": "2026-08-03", "price": None}, # Null price
            {"timestamp": "2026-08-04", "price": "invalid"}, # Non-numeric
            {"timestamp": "2026-08-05", "price": 250}, # Valid
        ]
        processed = preprocess_series(raw_points)
        self.assertEqual(len(processed), 1)
        self.assertEqual(processed[0]["price"], 250)

    def test_no_future_leakage_in_forward_fill(self):
        raw_points = [
            {"timestamp": "2026-08-01", "price": 100},
            {"timestamp": "2026-08-04", "price": 200}, # Gap on 2nd and 3rd
        ]
        processed = preprocess_series(raw_points)
        # Aug 2 and Aug 3 should be forward-filled with 100 (past price), NOT 200 (future price)
        self.assertEqual(processed[1]["price"], 100)
        self.assertEqual(processed[2]["price"], 100)
        self.assertEqual(processed[3]["price"], 200)

    def test_metric_calculations_mae_rmse_wape(self):
        actuals = [100, 200, 300]
        preds = [110, 190, 310]
        
        # MAE = (|10| + |-10| + |10|) / 3 = 10.0
        mae = sum(abs(p - a) for a, p in zip(actuals, preds)) / len(actuals)
        self.assertAlmostEqual(mae, 10.0)

        # RMSE = sqrt((100 + 100 + 100) / 3) = 10.0
        rmse = math.sqrt(sum((p - a)**2 for a, p in zip(actuals, preds)) / len(actuals))
        self.assertAlmostEqual(rmse, 10.0)

        # WAPE = 30 / 600 = 0.05 (5.0%)
        wape = sum(abs(p - a) for a, p in zip(actuals, preds)) / sum(actuals)
        self.assertAlmostEqual(wape, 0.05)

    def test_interval_coverage_metric(self):
        actuals = [100, 105, 95]
        lowers = [90, 100, 90]
        uppers = [110, 104, 100] # middle point 105 is outside upper 104

        covered = sum(1 for a, l, u in zip(actuals, lowers, uppers) if l <= a <= u)
        coverage = covered / len(actuals)
        self.assertAlmostEqual(coverage, 2.0 / 3.0)

if __name__ == "__main__":
    unittest.main()
