"""prediction engine - load model and get predictions"""

import pickle
import numpy as np
from typing import Dict, Any


class CrimePredictor:
    """crime predictor"""
    
    def __init__(self, model_path: str = None):
        """init with optional model path"""
        self.model = None
        self.scaler = None
        
        if model_path:
            self.load_model(model_path)
    
    def load_model(self, model_path: str):
        """load model from pickle file"""
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            print(f"loaded {model_path}")
        except Exception as e:
            print(f"error loading model: {e}")
            raise
    
    def predict(self, month: int, location: str) -> Dict[str, Any]:
        """get prediction for month and location"""
        try:
            # prep features and call model
            # features = self._prepare_features(month, location)
            # prediction = self.model.predict(features)
            
            # placeholder for now
            prediction_value = np.random.uniform(0, 1)
            
            if prediction_value < 0.33:
                category = 'Low'
            elif prediction_value < 0.66:
                category = 'Medium'
            else:
                category = 'High'
            
            return {
                'crime_rate': float(prediction_value),
                'crime_category': category,
                'confidence': 0.95,
                'factors': ['seasonal', 'location']
            }
        
        except Exception as e:
            print(f"predict error: {e}")
            raise
    
    def _prepare_features(self, month: int, location: str) -> np.ndarray:
        """convert input to feature vector"""
        # TODO: add feature engineering
        features = np.array([[month]])
        return features
    
    def save_model(self, model_path: str):
        """save model to pickle file"""
        try:
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            print(f"saved to {model_path}")
        except Exception as e:
            print(f"error saving: {e}")
            raise
