from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import logging
import sys
import os
import joblib

from features import FeatureCalculator

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

feature_calculator = FeatureCalculator()


def load_city_model(city_key: str):
    """Load a city-specific model from models/cities/<city_key>/ensemble_models.pkl.

    Returns the model instance or None if loading fails.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "models", "cities", city_key, "ensemble_models.pkl")

    if not os.path.exists(model_path):
        logger.warning(f"[model] No model file found for city='{city_key}' at {model_path}")
        return None

    try:
        model = joblib.load(model_path)
        logger.info(f"[model] Loaded city model for '{city_key}' from {model_path}")
        return model
    except Exception as e:
        logger.exception(f"[model] Failed to load model for '{city_key}' from {model_path}: {e}")
        return None


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {"status": "healthy", "timestamp": datetime.now().isoformat()}
    ), 200


@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json() or {}
        date_str = data.get("date")
        time_str = data.get("time")
        zipcode = data.get("zip_code")

        if not (date_str and time_str and zipcode):
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Expected JSON with fields: date, time, zip_code",
                    }
                ),
                400,
            )

        logger.info(
            f"[api] /api/predict date={date_str}, time={time_str}, zip={zipcode}"
        )

        # Compute features using the new FeatureCalculator
        features_df = feature_calculator.compute_features(zipcode, date_str, time_str)
        features = features_df.iloc[0].to_dict()

        tavg = float(features["tavg"])
        prcp = float(features["prcp"])
        logger.info(
            f"[api] features tavg={tavg}, prcp={prcp} "
            f"for ZIP={zipcode} on {date_str} {time_str}"
        )

        # Build feature vector in the order expected by the model
        feature_vector = feature_calculator.get_feature_vector(features_df)
        logger.info(f"[api] feature vector: {feature_vector}")

        # For now, treat everything as Seattle; later map ZIP -> city_key
        city_key = "seattle"
        model = load_city_model(city_key)

        prediction = {
            "crime_rate": 0.0,             # probability of crime (class 1)
            "crime_category": "Low",       # Low / Medium / High bucket
            "confidence": 0.0,              # max(p, 1-p)
            "factors": [],
            "error": None,
            "raw_output": None,             # raw probability from ensemble
            "is_good_prediction": False,    # True if confidence >= 0.7
            "has_enough_history": True,     # False when confidence < 0.7
            "message": "",                 # Human-readable summary
        }

        if model is None:
            prediction["error"] = f"Model for city '{city_key}' not loaded"
        else:
            try:
                # Support either a single estimator or a dict of estimators
                if isinstance(model, dict):
                    preds = []
                    for name, m in model.items():
                        if hasattr(m, "predict"):
                            try:
                                p = m.predict([feature_vector])
                                val = p[0] if hasattr(p, "__len__") and len(p) else p
                                preds.append(float(val))
                                logger.info(f"[model] sub-model '{name}' prediction={val}")
                            except Exception as sub_e:
                                logger.warning(f"[model] sub-model '{name}' failed: {sub_e}")
                        else:
                            logger.warning(f"[model] object under key '{name}' has no predict()")

                    if not preds:
                        raise RuntimeError("No usable sub-models with predict() in ensemble_models.pkl")

                    raw = sum(preds) / len(preds)
                else:
                    y = model.predict([feature_vector])
                    raw = y[0] if hasattr(y, "__len__") and len(y) else y

                prediction["raw_output"] = float(raw)

                # We treat output as P(class 1). For 2-class probs, confidence
                # is max(p0, p1). Here we only have p1 directly from ensemble.
                rate = float(prediction["raw_output"] or 0.0)
                prediction["crime_rate"] = rate
                prediction["confidence"] = max(rate, 1.0 - rate)
                prediction["is_good_prediction"] = prediction["confidence"] >= 0.7
                prediction["has_enough_history"] = prediction["is_good_prediction"]

                # Message for UI based on confidence threshold (0.7)
                if prediction["is_good_prediction"]:
                    if rate >= 0.5:
                        prediction["message"] = "Model is confident: higher risk period based on historical data."
                    else:
                        prediction["message"] = "Model is confident: lower risk period based on historical data."
                else:
                    prediction["message"] = "Model is uncertain here; not enough historical data for a strong prediction."

                # Simple bucketing for UI based on crime_rate probability
                if rate < 0.33:
                    prediction["crime_category"] = "Low"
                elif rate < 0.66:
                    prediction["crime_category"] = "Medium"
                else:
                    prediction["crime_category"] = "High"

                logger.info(
                    f"[api] model output for city={city_key}: raw={prediction['raw_output']}, "
                    f"rate={prediction['crime_rate']}, category={prediction['crime_category']}, "
                    f"confidence={prediction['confidence']}, good={prediction['is_good_prediction']}"
                )
            except Exception as e:
                logger.exception(f"[api] model prediction error for city={city_key}: {e}")
                prediction["error"] = "Model prediction failed"

        return (
            jsonify(
                {
                    "success": True,
                    "input": {
                        "date": date_str,
                        "time": time_str,
                        "zip_code": zipcode,
                    },
                    "features": features,
                    "feature_vector": feature_vector,
                    "prediction": prediction,
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception(f"[api] error in /api/predict: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    # Bind to all interfaces so you can hit it from your host if needed
    app.run(host="0.0.0.0", port=5000, debug=False)