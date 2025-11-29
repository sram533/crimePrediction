"""
Feature engineering module for crime prediction model
Calculates dynamic features from user inputs and external APIs
"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any
import requests
import logging
import joblib
import os
from sklearn.preprocessing import LabelEncoder
from meteostat import Point, Daily
import pgeocode

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Initialize pgeocode for ZIP to lat/lon conversion
nomi = pgeocode.Nominatim("us")

# Version marker to verify correct code is loaded
FEATURES_VERSION = "v2.0_meteostat_with_unit_conversion"


# ============================================================================  
# HELPERS  
# ============================================================================

def _normalize_zip(zipcode: Any) -> str:
    """
    Normalize ZIP code to a 5-character string.

    Handles ints, floats like 60601.0, and preserves leading zeros.
    """
    z = str(zipcode).strip()
    # Handle cases like "60601.0"
    if "." in z:
        z = z.split(".")[0]
    # Ensure 5 digits with leading zeros if needed
    return z.zfill(5)


# ============================================================================  
# LABEL ENCODERS & MODELS (Load from disk or initialize)  
# ============================================================================

def load_encoders_and_models():
    """Load pre-trained label encoders and clustering models from separate pickle files"""
    encoders = {
        "season_label_encoder": None,
        "temp_label_encoder": None,
        "freq_map": {},
        "loc_cluster_model": None,
        "zip_to_latlon": {},
    }

    # Try to load from disk - load each encoder separately
    try:
        encoders_dir = os.getenv("ENCODERS_DIR", "models/encoders")

        # Load season label encoder
        season_encoder_path = os.path.join(encoders_dir, "season_label_encoder.pkl")
        if os.path.exists(season_encoder_path):
            encoders["season_label_encoder"] = joblib.load(season_encoder_path)
            logger.info(f"Loaded season_label_encoder from {season_encoder_path}")

        # Load temperature label encoder
        temp_encoder_path = os.path.join(encoders_dir, "temp_label_encoder.pkl")
        if os.path.exists(temp_encoder_path):
            encoders["temp_label_encoder"] = joblib.load(temp_encoder_path)
            logger.info(f"Loaded temp_label_encoder from {temp_encoder_path}")

        # Load frequency map
        freq_map_path = os.path.join(encoders_dir, "freq_map.pkl")
        if os.path.exists(freq_map_path):
            encoders["freq_map"] = joblib.load(freq_map_path)
            logger.info(f"Loaded freq_map from {freq_map_path}")

        # Load location cluster model
        loc_cluster_path = os.path.join(encoders_dir, "loc_cluster_model.pkl")
        if os.path.exists(loc_cluster_path):
            encoders["loc_cluster_model"] = joblib.load(loc_cluster_path)
            logger.info(f"Loaded loc_cluster_model from {loc_cluster_path}")

    except Exception as e:
        logger.warning(f"Could not load encoders: {str(e)}")

    return encoders


# Initialize encoders at module level
ENCODERS = load_encoders_and_models()


# ============================================================================  
# WEATHER FALLBACK DATA (Monthly Averages)  
# ============================================================================

WEATHER_FALLBACK = {
    1: {"tavg": 32, "prcp": 0.8},
    2: {"tavg": 35, "prcp": 0.7},
    3: {"tavg": 45, "prcp": 1.0},
    4: {"tavg": 60, "prcp": 1.2},
    5: {"tavg": 70, "prcp": 1.3},
    6: {"tavg": 80, "prcp": 1.4},
    7: {"tavg": 85, "prcp": 1.5},
    8: {"tavg": 83, "prcp": 1.4},
    9: {"tavg": 75, "prcp": 1.3},
    10: {"tavg": 60, "prcp": 1.0},
    11: {"tavg": 45, "prcp": 0.9},
    12: {"tavg": 35, "prcp": 0.8},
}


# ============================================================================  
# MAJOR CITIES LIST (for urban/suburban/rural classification)  
# ============================================================================

MAJOR_CITIES = {
    "new york",
    "los angeles",
    "chicago",
    "houston",
    "phoenix",
    "philadelphia",
    "san antonio",
    "san diego",
    "dallas",
    "san jose",
    "austin",
    "jacksonville",
    "fort worth",
    "columbus",
    "charlotte",
    "san francisco",
    "indianapolis",
    "seattle",
    "denver",
    "boston",
    "miami",
    "atlanta",
    "minneapolis",
    "detroit",
    "portland",
    "las vegas",
    "baltimore",
    "memphis",
    "nashville",
    "new orleans",
}

# Define feature ranges and categories
SEASON_MAPPING = {
    12: "winter",
    1: "winter",
    2: "winter",  # Dec, Jan, Feb
    3: "spring",
    4: "spring",
    5: "spring",  # Mar, Apr, May
    6: "summer",
    7: "summer",
    8: "summer",  # Jun, Jul, Aug
    9: "fall",
    10: "fall",
    11: "fall",  # Sep, Oct, Nov
}

SEASON_ENCODING = {"winter": 0, "spring": 1, "summer": 2, "fall": 3}

TEMP_CATEGORY_ENCODING = {
    "cold": 0,  # < 32°F
    "cool": 1,  # 32-50°F
    "mild": 2,  # 50-68°F
    "warm": 3,  # 68-86°F
    "hot": 4,  # > 86°F
}

# ZCTA5 cluster encoding (ZIP code area clusters)
ZCTA5_CLUSTER_ENCODING = {"urban": 0, "suburban": 1, "rural": 2}


class FeatureCalculator:
    """
    Calculates all required features for the ML model.

    Features computed:
    - Temporal (7): hour, day_of_week, month, is_weekend, is_night, is_rush_hour, is_business_hours
    - Weather (4): tavg, prcp, temp_category_encoded, is_rainy
    - Location (2): ZCTA5_freq_encoded, loc_cluster
    - Season (1): season_encoded

    Total: 14 features
    """

    def __init__(self, encoders: Dict[str, Any] = None):
        """
        Initialize with optional pre-trained encoders

        Args:
            encoders: Dictionary with season_label_encoder, temp_label_encoder, freq_map, etc.
        """
        self.encoders = encoders or ENCODERS
        self.weather_cache = {}

    def compute_features(self, zipcode: str, date_str: str, time_str: str) -> pd.DataFrame:
        """
        Compute all 14 features for the ML model.

        Args:
            zipcode: ZIP code (e.g., "60601" or 60601)
            date_str: Date string (e.g., "2025-06-15")
            time_str: Time string (e.g., "14:30:00")

        Returns:
            DataFrame with single row containing all 14 features
        """
        # Normalize ZIP early to avoid pgeocode/mapping issues
        zipcode = _normalize_zip(zipcode)

        logger.info(f"[features] compute_features ZIP={zipcode}, date={date_str}, time={time_str}")

        # ---------------------- 1. DATETIME FEATURES ----------------------
        try:
            dt = pd.to_datetime(f"{date_str} {time_str}")
        except Exception as e:
            logger.error(f"Invalid datetime format: {date_str} {time_str}")
            raise ValueError(f"Invalid datetime: {str(e)}")

        hour = dt.hour  # 0-23
        day_of_week = dt.dayofweek  # 0=Monday, 6=Sunday
        month = dt.month  # 1-12
        is_weekend = 1 if day_of_week in [5, 6] else 0  # Saturday=5, Sunday=6
        is_night = 1 if (hour >= 18 or hour <= 6) else 0  # 6 PM to 6 AM
        is_rush_hour = 1 if (7 <= hour <= 9 or 16 <= hour <= 18) else 0  # Morning & evening rush
        is_business_hours = 1 if (9 <= hour <= 17 and day_of_week < 5) else 0  # 9-5 weekdays
        season = (month % 12 + 3) // 3  # Season calculation (1-4)

        # ---------------------- 2. WEATHER FEATURES ----------------------
        tavg, prcp = self._get_weather_data(zipcode, month, date_str)
        is_rainy = 1 if prcp > 0 else 0
         # TEMP: If we got monthly fallback for this date/zip, force a direct Meteostat fetch
        if month == 11 and tavg == 45 and prcp == 0.9:
            logger.info("[weather] Detected November fallback for 98144; forcing direct Meteostat fetch")
            try:
                date_dt = pd.to_datetime(date_str)
                from meteostat import Point, Daily
                import pgeocode

                location = nomi.query_postal_code(zipcode)
                if not pd.isna(location.latitude) and not pd.isna(location.longitude):
                    point = Point(location.latitude, location.longitude)
                    data = Daily(point, start=date_dt, end=date_dt).fetch()
                    if not data.empty:
                        tavg = float(data["tavg"].iloc[0])
                        prcp = float(data["prcp"].iloc[0])
                        logger.info(
                            f"[weather] Overrode fallback with Meteostat: ZIP={zipcode}, "
                            f"date={date_str}, tavg={tavg}, prcp={prcp}"
                        )
            except Exception as e:
                logger.warning(f"[weather] Failed override Meteostat fetch: {e!r}")

        # ---------------------- 3. SEASON ENCODING ----------------------
        # Season from month: 1-3=winter(0), 4-6=spring(1), 7-9=summer(2), 10-12=fall(3)
        season_encoded = self._encode_season(season)

        # ---------------------- 4. TEMPERATURE CATEGORY ENCODING ----------------------
        temp_cat = self._categorize_temperature(tavg)
        temp_category_encoded = self._encode_temp_category(temp_cat)

        # ---------------------- 5. ZIP CODE FREQUENCY ENCODING ----------------------
        ZCTA5_freq_encoded = self._get_zcta5_frequency(zipcode)

        # ---------------------- 6. LOCATION CLUSTER ----------------------
        loc_cluster = self._predict_location_cluster(zipcode)

        # ---------------------- BUILD FEATURE DICTIONARY ----------------------
        features = {
            # Input features
            "date": date_str,
            "time": time_str,
            "zip_code": zipcode,
            # Computed features
            "tavg": tavg,
            "prcp": prcp,
            "hour": hour,
            "day_of_week": day_of_week,
            "month": month,
            "is_weekend": is_weekend,
            "is_night": is_night,
            "is_rush_hour": is_rush_hour,
            "is_business_hours": is_business_hours,
            "ZCTA5_freq_encoded": ZCTA5_freq_encoded,
            "season_encoded": season_encoded,
            "temp_category_encoded": temp_category_encoded,
            "is_rainy": is_rainy,
            "loc_cluster": loc_cluster,
        }

        # Log full 14-feature map to inspect encoders and values
        logger.info("[features] full feature map: " + ", ".join(
            f"{k}={v}" for k, v in features.items()
        ))

        # Return as DataFrame (single row)
        df = pd.DataFrame([features])
        return df

    # ========================================================================  
    # HELPER METHODS  
    # ========================================================================

    def _get_weather_data(self, zipcode: str, month: int, date_str: str | None = None):
        """Get daily temperature and precipitation using Meteostat + pgeocode.

        Falls back to monthly averages when data or coordinates are unavailable.
        """
        zipcode = _normalize_zip(zipcode)
        cache_key = (zipcode, date_str or month)

        # Cache lookup
        if cache_key in self.weather_cache:
            logger.info(f"[weather] cache hit for {cache_key}: {self.weather_cache[cache_key]}")
            return self.weather_cache[cache_key]

        try:
            if not date_str:
                date_str = datetime.now().strftime("%Y-%m-%d")

            date_dt = pd.to_datetime(date_str)

            # ZIP -> lat/lon via pgeocode
            location = nomi.query_postal_code(zipcode)
            if pd.isna(location.latitude) or pd.isna(location.longitude):
                logger.warning(f"[weather] no coordinates for ZIP={zipcode}, using fallback")
                result = self._get_weather_fallback(month)
                self.weather_cache[cache_key] = result
                return result

            point = Point(location.latitude, location.longitude)
            logger.info(
                f"[weather] fetching Meteostat for ZIP={zipcode} "
                f"lat={location.latitude}, lon={location.longitude}, date={date_str}"
            )

            # Fetch daily weather using Meteostat
            data = Daily(point, start=date_dt, end=date_dt).fetch()
            if data.empty:
                logger.warning(f"[weather] empty Meteostat data for {zipcode} on {date_str}, using fallback")
                result = self._get_weather_fallback(month)
                self.weather_cache[cache_key] = result
                return result

            tavg = float(data["tavg"].iloc[0]) if "tavg" in data.columns else None
            prcp = float(data["prcp"].iloc[0]) if "prcp" in data.columns else None

            if tavg is None or prcp is None:
                logger.warning(f"[weather] tavg/prcp missing for {zipcode} on {date_str}, using fallback")
                result = self._get_weather_fallback(month)
            else:
                result = (tavg, prcp)
                logger.info(
                    f"[weather] got Meteostat values ZIP={zipcode} on {date_str}: "
                    f"tavg={tavg}, prcp={prcp}"
                )

            self.weather_cache[cache_key] = result
            return result

        except Exception as e:
            logger.warning(f"[weather] exception for {zipcode} on {date_str}: {e!r}, using fallback")
            result = self._get_weather_fallback(month)
            self.weather_cache[cache_key] = result
            return result

    def _get_weather_fallback(self, month: int):
        """Get fallback weather from hardcoded monthly averages"""
        data = WEATHER_FALLBACK.get(month, {"tavg": 60, "prcp": 1.0})
        return (data["tavg"], data["prcp"])

    def _get_coordinates(self, zipcode: str):
        """
        Get latitude/longitude for ZIP code.
        Uses pre-loaded map or fetches from Zippopotamus API.

        Returns:
            Tuple of (latitude, longitude) or (None, None) if not found
        """
        zipcode = _normalize_zip(zipcode)

        # Check pre-loaded map
        if zipcode in self.encoders.get("zip_to_latlon", {}):
            coords = self.encoders["zip_to_latlon"][zipcode]
            return (coords[0], coords[1])

        try:
            # Try Zippopotamus API
            url = f"https://api.zippopotam.us/us/{zipcode}"
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                data = response.json()
                place = data.get("places", [{}])[0]
                lat = float(place.get("latitude", 0))
                lon = float(place.get("longitude", 0))
                if lat != 0 and lon != 0:
                    return (lat, lon)
        except Exception as e:
            logger.warning(f"Could not get coordinates for {zipcode}: {str(e)}")

        return (None, None)

    def _categorize_temperature(self, tavg: float) -> str:
        """
        Categorize temperature into bins.

        Args:
            tavg: Average temperature value

        Returns:
            Category string: "Cold", "Cool", "Warm", "Hot"
        """
        if tavg <= 40:
            return "Cold"
        elif tavg <= 60:
            return "Cool"
        elif tavg <= 80:
            return "Warm"
        else:
            return "Hot"

    def _encode_season(self, season: int) -> int:
        """
        Encode season as integer.

        Args:
            season: Season (1-4)

        Returns:
            Encoded value (0-3)
        """
        if self.encoders.get("season_label_encoder"):
            try:
                return self.encoders["season_label_encoder"].transform([str(season)])[0]
            except Exception as e:
                logger.warning(f"Season encoding error: {str(e)}")

        # Fallback: season - 1
        return max(0, min(3, season - 1))

    def _encode_temp_category(self, temp_cat: str) -> int:
        """
        Encode temperature category using the label encoder from pickle file.
        Falls back to simple mapping if encoder is incomplete.

        Args:
            temp_cat: Temperature category string ("Cold", "Cool", "Warm", "Hot")

        Returns:
            Encoded value using temp_label_encoder or fallback mapping
        """
        temp_encoder = self.encoders.get("temp_label_encoder")

        # Simple fallback mapping (capitalized to match _categorize_temperature)
        fallback_mapping = {
            "Cold": 0,
            "Cool": 1,
            "Warm": 2,
            "Hot": 3,
        }

        if temp_encoder is None:
            logger.warning("temp_label_encoder not found, using fallback mapping")
            return fallback_mapping.get(temp_cat, 1)

        try:
            # Always pass a 1D array to transform
            if temp_cat not in temp_encoder.classes_:
                logger.warning(
                    f"Temp category '{temp_cat}' not in encoder classes, using fallback"
                )
                return fallback_mapping.get(temp_cat, 1)
            encoded = temp_encoder.transform([temp_cat])[0]
            return int(encoded)
        except Exception as e:
            logger.warning(
                f"Failed to encode temp category '{temp_cat}': {str(e)}, using fallback"
            )
            return fallback_mapping.get(temp_cat, 1)

    def _get_zcta5_frequency(self, zipcode: str) -> int:
        """
        Get frequency encoding for ZIP code.
        Represents how frequently this ZIP appears in historical data.

        Args:
            zipcode: ZIP code

        Returns:
            Frequency encoding (0-99 typically)
        """
        zipcode = _normalize_zip(zipcode)
        freq_map = self.encoders.get("freq_map", {})
        return freq_map.get(zipcode, 0)  # Default to 0 for unseen ZIPs

    def _predict_location_cluster(self, zipcode: str) -> int:
        """
        Predict location cluster (urban/suburban/rural).
        Uses pre-trained KMeans model if available, else uses heuristics.

        Args:
            zipcode: ZIP code

        Returns:
            Cluster (0=urban, 1=suburban, 2=rural)
        """
        zipcode = _normalize_zip(zipcode)

        # Try to use pre-trained model
        loc_model = self.encoders.get("loc_cluster_model")
        zip_to_coords = self.encoders.get("zip_to_latlon", {})

        if loc_model and zipcode in zip_to_coords:
            try:
                coords = zip_to_coords[zipcode]
                cluster = loc_model.predict(np.array(coords).reshape(1, -1))[0]
                return int(cluster)
            except Exception as e:
                logger.warning(f"Cluster prediction error: {str(e)}")

        # Fallback to heuristics
        return self._classify_location_heuristic(zipcode)

    def _classify_location_heuristic(self, zipcode: str) -> int:
        """
        Simple heuristic for location classification when model unavailable.

        Args:
            zipcode: ZIP code

        Returns:
            Cluster (0=urban, 1=suburban, 2=rural)
        """
        # Default: suburban (1)
        return 1

    def get_feature_vector(self, df: pd.DataFrame):
        """
        Convert DataFrame of features to ordered list for model input.

        Args:
            df: DataFrame with features

        Returns:
            Ordered list of 14 feature values
        """
        feature_order = [
            "tavg",
            "prcp",
            "hour",
            "day_of_week",
            "month",
            "is_weekend",
            "is_night",
            "is_rush_hour",
            "is_business_hours",
            "ZCTA5_freq_encoded",
            "season_encoded",
            "temp_category_encoded",
            "is_rainy",
            "loc_cluster",
        ]

        if len(df) == 0:
            raise ValueError("Empty DataFrame")

        row = df.iloc[0]
        vector = []

        for feature_name in feature_order:
            if feature_name not in row.index:
                raise ValueError(f"Missing feature: {feature_name}")
            vector.append(float(row[feature_name]))

        return vector
