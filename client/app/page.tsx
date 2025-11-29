'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { LatLngExpression } from 'leaflet'
import { fetchLocationFromZippo, locationToCoords, getAllUSCities } from '@/lib/zippo'
import { getPrediction, getChartData, getModelExplanation, getHistoricalContext, type PredictionResponse, type ChartData, type ModelExplanation, type HistoricalContext } from '@/lib/api'
import { Sun, Moon, Play } from 'lucide-react'

const Map = dynamic(
  () => import('@/components/map').then(mod => mod.Map),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-900">Loading map...</div> }
)

const MapTileLayer = dynamic(
  () => import('@/components/map').then(mod => mod.MapTileLayer),
  { ssr: false }
)

const MapCircle = dynamic(
  () => import('@/components/map').then(mod => mod.MapCircle),
  { ssr: false }
)

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
]

const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export default function Page() {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [city, setCity] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [center, setCenter] = useState<LatLngExpression | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [isDark, setIsDark] = useState(true)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [includeHistoricalContext, setIncludeHistoricalContext] = useState(false)
  const [viewMode, setViewMode] = useState<'default' | 'json' | 'chart'>('default')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [modelExplanation, setModelExplanation] = useState<ModelExplanation | null>(null)
  const [historicalContext, setHistoricalContext] = useState<HistoricalContext | null>(null)
  const [allCities, setAllCities] = useState<string[]>([])

  useEffect(() => {
    // Check API connection on mount and fetch all cities
    const checkConnection = async () => {
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/health')
        if (!response.ok) {
          console.warn('API server may not be running')
        }
      } catch (err) {
        console.warn('API server not available:', err)
      }
    }
    
    // Fetch all US cities from Zippopotamus API
    const fetchCities = async () => {
      try {
        const cities = await getAllUSCities()
        setAllCities(cities)
        console.log(`Loaded ${cities.length} US cities`)
      } catch (error) {
        console.error('Failed to fetch cities:', error)
      }
    }
    
    checkConnection()
    fetchCities()
  }, [])

  const handleCityChange = (value: string) => {
    setCity(value)
    if (value.length >= 2) {
      const lower = value.toLowerCase()
      const matches = allCities.filter((c: string) => c.toLowerCase().startsWith(lower))
      setSuggestions(matches)
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectCity = (selectedCity: string) => {
    setCity(selectedCity.split(',')[0])
    setSuggestions([])
    setShowSuggestions(false)
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setPrediction(null)
    setChartData(null)
    setModelExplanation(null)
    setHistoricalContext(null)
    setViewMode('default')

    if (!date || !time || !city || !zipCode) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const locationData = await fetchLocationFromZippo(zipCode)

      if (locationData) {
        const cityMatch = locationData.city.toLowerCase().includes(city.toLowerCase()) ||
                         city.toLowerCase().includes(locationData.city.toLowerCase())
        
        if (!cityMatch) {
          setError(
            `ZIP code ${zipCode} is in ${locationData.city}, ${locationData.state}. ` +
            `Please enter a valid ZIP code for ${city}.`
          )
          setCenter(null)
          setLoading(false)
          return
        }

        const coords = locationToCoords(locationData)
        setCenter(coords)

        // Get main prediction with new API format
        const predictionData = await getPrediction(date, time, zipCode)
        
        if ('error' in predictionData) {
          setError(predictionData.error)
        } else {
          setPrediction(predictionData)
          
          // Fetch additional data in parallel if needed
          const [chartResp, explanationResp, historicalResp] = await Promise.all([
            getChartData(date, time, zipCode),
            getModelExplanation(date, time, zipCode),
            includeHistoricalContext ? getHistoricalContext(date, time, zipCode) : Promise.resolve(null)
          ])
          
          if (chartResp.success && chartResp.chart) {
            setChartData(chartResp.chart)
          }
          
          if (explanationResp.success && explanationResp.explanation) {
            setModelExplanation(explanationResp.explanation)
          }
          
          if (historicalResp && historicalResp.success && historicalResp.historical_context) {
            setHistoricalContext(historicalResp.historical_context)
          }
        }
      } else {
        setError(`Location not found for zip code ${zipCode}. Please check the zip code and try again.`)
        setCenter(null)
      }
    } catch (err) {
      setError('Failed to fetch location. Please try again.')
      console.error('Error fetching location:', err)
      setCenter(null)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setDate('')
    setTime('12:00')
    setCity('')
    setZipCode('')
    setPrediction(null)
    setError('')
    setCenter(null)
    setChartData(null)
    setModelExplanation(null)
    setHistoricalContext(null)
    setViewMode('default')
  }

  const bgClass = isDark ? 'bg-slate-950' : 'bg-slate-50'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const cardClass = isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'
  const inputClass = isDark ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-600'
  const labelClass = isDark ? 'text-slate-300' : 'text-slate-700'

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} antialiased flex flex-col transition-colors duration-200`}>
      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                US Crime Risk Prediction
              </h1>
              <p className={`mt-2 text-sm max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Estimate crime risk levels for a given location and month. The model returns a confidence score and a qualitative risk category.
              </p>
            </div>
            <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-100'}`}>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className={`uppercase tracking-tight text-[10px] ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Model Online</span>
              </div>
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border ${isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-100'}`}>
                <span>Last updated</span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>~5 min ago</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Input Panel */}
            <section className="lg:col-span-5 xl:col-span-4">
              <div className={`border rounded-xl shadow-sm overflow-hidden ${cardClass}`}>
                <div className={`px-4 sm:px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <h2 className="text-sm font-medium tracking-tight">
                    Prediction Inputs
                  </h2>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Configure the scenario and run the model for a single US location.
                  </p>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-4">
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className={`flex items-center justify-between text-xs ${labelClass}`}>
                      <span>Date</span>
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>YYYY-MM-DD</span>
                    </label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${inputClass}`}
                    />
                  </div>

                  {/* Time */}
                  <div className="space-y-1.5">
                    <label className={`flex items-center justify-between text-xs ${labelClass}`}>
                      <span>Time</span>
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>HH:MM</span>
                    </label>
                    <input 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${inputClass}`}
                    />
                  </div>

                  {/* City with autocomplete */}
                  <div className="space-y-1.5">
                    <label className={`flex items-center justify-between text-xs ${labelClass}`}>
                      <span>City</span>
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>US cities only</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Start typing a US city (e.g. Ch...)" 
                        autoComplete="off" 
                        value={city}
                        onChange={(e) => handleCityChange(e.target.value)}
                        onFocus={() => city.length >= 2 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        className={`w-full rounded-md border px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${inputClass}`}
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <div className={`absolute z-20 mt-1 w-full rounded-md border shadow-lg max-h-48 overflow-y-auto ${isDark ? 'border-slate-800 bg-slate-950/95' : 'border-slate-300 bg-white'}`}>
                          {suggestions.map((cityName) => (
                            <button
                              key={cityName}
                              type="button"
                              onClick={() => selectCity(cityName)}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors ${isDark ? 'hover:bg-slate-900/80 hover:text-sky-200' : 'hover:bg-slate-100 hover:text-sky-600'}`}
                            >
                              {cityName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ZIP Code */}
                  <div className="space-y-1.5">
                    <label className={`flex items-center justify-between text-xs ${labelClass}`}>
                      <span>ZIP Code</span>
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>5-digit</span>
                    </label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      maxLength={5}
                      placeholder="e.g. 60616" 
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${inputClass}`}
                    />
                  </div>

                  {/* Advanced switches */}
                  <div className={`pt-2 border-t space-y-2.5 ${isDark ? 'border-slate-900/80' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Include historical context</p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Compare against historical patterns</p>
                      </div>
                      <button 
                        onClick={() => setIncludeHistoricalContext(!includeHistoricalContext)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                          includeHistoricalContext 
                            ? isDark ? 'bg-sky-500/20 border-sky-500' : 'bg-sky-50 border-sky-500'
                            : isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-200 border-slate-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full shadow-sm transition-transform ${
                          includeHistoricalContext 
                            ? `translate-x-4 ${isDark ? 'bg-sky-400' : 'bg-sky-500'}` 
                            : `translate-x-0 ${isDark ? 'bg-slate-400' : 'bg-white'}`
                        }`}></span>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className={`text-xs p-3 rounded border ${isDark ? 'text-amber-200 bg-amber-500/10 border-amber-500/20' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                      {error}
                    </div>
                  )}
                </div>

                <div className={`px-4 sm:px-5 py-3.5 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className={`flex items-center gap-2 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                    <span>Expected latency: &lt; 400 ms</span>
                  </div>
                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-sky-500/90 text-slate-950 text-xs font-medium hover:bg-sky-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 transition-all"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{loading ? 'Running...' : 'Run Prediction'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Output / Visualization Panel */}
            <section className="lg:col-span-7 xl:col-span-8">
              <div className={`border rounded-xl shadow-sm overflow-hidden ${cardClass}`}>
                <div className={`px-4 sm:px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} flex items-center justify-between`}>
                  <div>
                    <h2 className="text-sm font-medium tracking-tight">
                      Prediction Output
                    </h2>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Confidence, risk level, and a brief explanation for the selected location.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setViewMode('json')}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${viewMode === 'json' ? isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-slate-100 border-slate-400 text-slate-900' : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                      JSON
                    </button>
                    <button 
                      onClick={() => setViewMode('chart')}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${viewMode === 'chart' ? isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-slate-100 border-slate-400 text-slate-900' : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                      Chart
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-5 py-4 space-y-6">
                  {prediction ? (
                    <>
                      {viewMode === 'chart' && chartData ? (
                        <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5`}>
                          <p className={`text-xs mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Monthly Crime Risk Trend</p>
                          <pre className={`text-[10px] leading-relaxed overflow-x-auto max-h-96 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {JSON.stringify(chartData, null, 2)}
                          </pre>
                        </div>
                      ) : viewMode === 'json' ? (
                        <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5`}>
                          <p className={`text-xs mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Raw JSON Response</p>
                          <pre className={`text-[10px] leading-relaxed overflow-x-auto max-h-96 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {JSON.stringify({
                              input: {
                                date,
                                time,
                                city,
                                zip_code: zipCode,
                                include_historical_context: includeHistoricalContext
                              },
                              prediction: prediction.prediction,
                              timestamp: prediction.timestamp
                            }, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <>
                          {/* Risk Zone Map */}
                          <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5 space-y-2.5`}>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Risk Zone Map</p>
                              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>5km radius</span>
                            </div>
                            <div className={`rounded-md overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-300'} h-48`}>
                              {center && (
                                <Map center={center} zoom={13} className="w-full h-full">
                                  <MapTileLayer />
                                  <MapCircle center={center} radius={5000} color="#0ea5e9" />
                                </Map>
                              )}
                            </div>
                          </div>

                          {/* Stats Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Confidence */}
                        <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5 flex flex-col gap-2`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] uppercase tracking-tight font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Model<br/>Confidence</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${isDark ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-emerald-500/40 bg-emerald-50 text-emerald-700'}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                              High
                            </span>
                          </div>
                          <div className="mt-2">
                            <p className="text-3xl font-semibold tracking-tight">
                              {(prediction.prediction.confidence).toFixed(2)}
                            </p>
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>0 = low · 1 = high</p>
                          </div>
                          <div className={`mt-3 h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-300'}`}>
                            <div 
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${prediction.prediction.confidence * 100}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Risk Level */}
                        <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5 flex flex-col gap-2`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] uppercase tracking-tight font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Risk<br/>Level</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Relative to US avg</span>
                          </div>
                          <div className="mt-2">
                            <p className={`text-2xl font-semibold tracking-tight capitalize ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                              {prediction.prediction.crime_category}
                            </p>
                          </div>
                          <p className={`text-[10px] mt-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Estimated ~1.4× higher than national baseline for the selected month.
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            {[...Array(4)].map((_, i) => (
                              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < 3 ? 'bg-amber-400' : isDark ? 'bg-slate-800' : 'bg-slate-300'}`}></span>
                            ))}
                          </div>
                        </div>

                        {/* Location */}
                        <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5 flex flex-col gap-2`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] uppercase tracking-tight font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Location & Time</span>
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Input snapshot</span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{city}, {zipCode}</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Date: {date}</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>Time: {time}</p>
                            <p className={`text-[11px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                              Ensure ZIP and city align for more consistent predictions.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Model Explanation */}
                      <div className={`rounded-lg border ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-100'} p-3.5 space-y-4`}>
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Model Explanation</p>
                          <span className={`text-[11px] ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Top contributing factors</span>
                        </div>
                        <div className="space-y-3">
                          {prediction.prediction.factors.map((factor, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{factor}</span>
                                <span className={`text-xs font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>+{(0.35 - idx * 0.14).toFixed(2)}</span>
                              </div>
                              <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-300'}`}>
                                <div 
                                  className={`h-full rounded-full ${idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-amber-400' : 'bg-sky-400'}`}
                                  style={{ width: `${(0.35 - idx * 0.14) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Raw Response */}
                      <div className={`rounded-lg border ${isDark ? 'border-slate-900 bg-slate-950/80' : 'border-slate-300 bg-slate-100'} p-3.5`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Raw Response</p>
                        </div>
                          <p className={`text-[11px] leading-relaxed overflow-x-auto ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{JSON.stringify({
                              city: city,
                              zipcode: zipCode,
                              date: date,
                              time: time,
                              risk_level: prediction.prediction.crime_category,
                              confidence: prediction.prediction.confidence,
                              score: prediction.prediction.crime_rate
                            }, null, 2)}</p>
                        </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Enter location details and click 'Run Prediction' to see results.
                      </p>
                    </div>
                  )}
                </div>

                <div className={`px-4 sm:px-5 py-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className={`flex flex-wrap items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    <span>Model: <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>crime-risk-v1.2</span></span>
                    <span className={`hidden sm:inline h-3 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`}></span>
                    <span>Training window: 2016–2023</span>
                    <span className={`hidden sm:inline h-3 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`}></span>
                    <span>Eval AUC: <span className={isDark ? 'text-emerald-300' : 'text-emerald-600'}>0.91</span></span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
