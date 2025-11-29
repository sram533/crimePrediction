import axios from 'axios'

// api url from env or localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface PredictionRequest {
  hour: number
  day: number
  month: number
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  include_historical_context?: boolean
}

export interface FeatureSet {
  temporal: {
    hour: number
    day_of_week: number
    month: number
    is_weekend: number
    is_night: number
    is_rush_hour: number
    is_business_hours: number
  }
  weather: {
    tavg: number
    prcp: number
    temp_category_encoded: number
    is_rainy: number
  }
  location: {
    ZCTA5_freq_encoded: number
    loc_cluster: number
  }
  season: {
    season_encoded: number
  }
}

export interface PredictionData {
  crime_rate: number
  crime_category: string
  confidence: number
  factors: string[]
  features_used?: Record<string, any>
  error?: string
}

export interface PredictionResponse {
  success: boolean
  input: PredictionRequest
  features: FeatureSet
  feature_vector: number[]
  prediction: PredictionData
  historical_context?: {
    past_12_months_average: number
    trend: string
    seasonal_factor: number
    year_over_year_change: number
  }
  timestamp: string
}

export interface ErrorResponse {
  error: string
  success: false
}

export interface ChartData {
  type: string
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    borderColor: string
    backgroundColor: string
    tension?: number
    borderDash?: number[]
  }>
}

export interface ExplanationFactor {
  name: string
  contribution: number
  weight: string
  description: string
}

export interface ModelExplanation {
  base_rate: number
  factors: ExplanationFactor[]
  prediction: number
  confidence: number
}

export interface HistoricalContext {
  past_12_months: {
    average: number
    min: number
    max: number
    trend: string
  }
  past_5_years: {
    average: number
    trend: string
    year_over_year_change: number
  }
  seasonal_pattern: {
    winter: number
    spring: number
    summer: number
    fall: number
  }
  anomalies: Array<{
    date: string
    value: number
    reason: string
  }>
}

// check if api is up
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get('/health')
    return response.status === 200
  } catch (error) {
    console.error('api unreachable:', error)
    return false
  }
}

// get prediction from api with dynamic feature engineering
export async function getPrediction(
  date: string,
  time: string,
  zipCode: string
): Promise<PredictionResponse | ErrorResponse> {
  try {
    const response = await apiClient.post<PredictionResponse>('/predict', { date, time, zip_code: zipCode })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ErrorResponse
    }
    return {
      error: 'Failed to get prediction.',
      success: false,
    }
  }
}

// fetch available locations
export async function getAvailableLocations(): Promise<string[]> {
  try {
    const response = await apiClient.get('/locations')
    return response.data.locations || []
  } catch (error) {
    console.error('failed to fetch locations:', error)
    return []
  }
}

// batch predictions
export async function getBatchPredictions(
  predictions: PredictionRequest[]
): Promise<{
  success: boolean
  total: number
  results: Array<{
    success: boolean
    input: { month: number; location: string }
    prediction?: {
      crime_rate: number
      crime_category: string
      confidence: number
    }
    error?: string
  }>
}> {
  try {
    const response = await apiClient.post('/predict/batch', {
      predictions,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data
    }
    return {
      success: false,
      total: 0,
      results: [],
    }
  }
}

// get chart data for visualization
export async function getChartData(
  date: string,
  time: string,
  zipCode: string
): Promise<{ success: boolean; chart?: ChartData; error?: string }> {
  try {
    const response = await apiClient.post('/chart', {
      date,
      time,
      zip_code: zipCode,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data
    }
    return {
      success: false,
      error: 'Failed to fetch chart data.',
    }
  }
}

// get model explanation with factor contributions
export async function getModelExplanation(
  date: string,
  time: string,
  zipCode: string
): Promise<{ success: boolean; explanation?: ModelExplanation; error?: string }> {
  try {
    const response = await apiClient.post('/explanation', {
      date,
      time,
      zip_code: zipCode,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data
    }
    return {
      success: false,
      error: 'Failed to fetch model explanation.',
    }
  }
}

// get historical context for a location
export async function getHistoricalContext(
  date: string,
  time: string,
  zipCode: string
): Promise<{ success: boolean; historical_context?: HistoricalContext; error?: string }> {
  try {
    const response = await apiClient.post('/historical', {
      date,
      time,
      zip_code: zipCode,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data
    }
    return {
      success: false,
      error: 'Failed to fetch historical context.',
    }
  }
}

// get prediction with historical context
export async function getPredictionWithContext(
  month: number,
  location: string,
  includeHistoricalContext: boolean = false
): Promise<PredictionResponse | ErrorResponse> {
  try {
    const response = await apiClient.post<PredictionResponse>('/predict', {
      month,
      location,
      include_historical_context: includeHistoricalContext,
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data as ErrorResponse
    }
    return {
      error: 'Failed to get prediction.',
      success: false,
    }
  }
}
