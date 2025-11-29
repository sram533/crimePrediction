import type { LatLngExpression } from 'leaflet'

export interface ZippoLocation {
  city: string
  state: string
  latitude: number
  longitude: number
  zipCode: string
}

/**
 * Fetch location data from Zippopotamus API
 * @param zipCode - US ZIP code (5 digits)
 * @returns Location data with coordinates, or null if not found
 */
export async function fetchLocationFromZippo(zipCode: string): Promise<ZippoLocation | null> {
  try {
    const cleanZip = zipCode.trim().replace(/\D/g, '').slice(0, 5)
    
    if (cleanZip.length !== 5) {
      console.error('Invalid ZIP code format')
      return null
    }

    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`)
    
    if (!response.ok) {
      console.error(`API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Zippopotamus API returns multiple places for a ZIP code
    // We'll use the first one
    if (data.places && data.places.length > 0) {
      const place = data.places[0]
      return {
        city: place['place name'],
        state: place['state abbreviation'],
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude),
        zipCode: data['post code'],
      }
    }

    return null
  } catch (error) {
    console.error('Failed to fetch location from Zippopotamus:', error)
    return null
  }
}

/**
 * Convert location to Leaflet LatLngExpression
 */
export function locationToCoords(location: ZippoLocation): LatLngExpression {
  return [location.latitude, location.longitude]
}

/**
 * Search for cities by state
 * @param state - State code (e.g., 'CA', 'NY', 'IL')
 * @returns Array of locations in that state
 */
export async function searchCitiesByState(state: string): Promise<ZippoLocation[]> {
  try {
    const cleanState = state.trim().toUpperCase()
    
    if (cleanState.length !== 2) {
      console.error('Invalid state code format')
      return []
    }

    const response = await fetch(`https://api.zippopotam.us/us/${cleanState}`)
    
    if (!response.ok) {
      console.error(`API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    
    const locations: ZippoLocation[] = []
    
    if (data.places) {
      const seen = new Set<string>()
      
      for (const place of data.places) {
        const cityKey = `${place['place name']}-${place.latitude}-${place.longitude}`
        
        if (!seen.has(cityKey)) {
          seen.add(cityKey)
          locations.push({
            city: place['place name'],
            state: place['state abbreviation'],
            latitude: parseFloat(place.latitude),
            longitude: parseFloat(place.longitude),
            zipCode: place.code || '',
          })
        }
      }
    }

    return locations
  } catch (error) {
    console.error('Failed to search cities by state:', error)
    return []
  }
}

/**
 * Get all US cities from Zippopotamus API
 * Uses a practical approach: fetches from a sample of popular ZIP codes
 * This avoids rate limiting and provides a good dataset of major cities
 * @returns Array of all US locations
 */
export async function getAllUSCities(): Promise<string[]> {
  try {
    // Popular ZIP codes across all US states (one per state approximately)
    // This gives us a representative sample of cities
    const POPULAR_ZIP_CODES = [
      '35004', '99501', '85001', '72201', '90001', '80202', '06101', '19801',
      '32099', '30303', '96814', '83702', '60601', '46204', '50309', '66101',
      '40507', '70112', '04101', '21202', '02101', '48201', '55401', '39056',
      '63101', '59101', '68102', '89101', '03101', '07102', '87101', '10001',
      '28202', '58001', '43085', '73102', '97201', '17101', '02903', '29202',
      '57101', '37501', '75001', '84101', '05401', '22202', '98101', '25301',
      '53202', '82001'
    ]

    const citySet = new Set<string>()
    
    // Fetch cities from popular ZIP codes
    for (let i = 0; i < POPULAR_ZIP_CODES.length; i++) {
      // Add small delay to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      try {
        const location = await fetchLocationFromZippo(POPULAR_ZIP_CODES[i])
        if (location) {
          citySet.add(`${location.city}, ${location.state}`)
        }
      } catch (error) {
        console.warn(`Failed to fetch city for ZIP ${POPULAR_ZIP_CODES[i]}:`, error)
      }
    }

    // Add popular major cities that should always be included
    const MAJOR_CITIES = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA',
      'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL',
      'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA',
      'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Boston, MA',
      'El Paso, TX', 'Memphis, TN', 'Nashville, TN', 'Detroit, MI',
      'Oklahoma City, OK', 'Portland, OR', 'Las Vegas, NV', 'Louisville, KY',
      'Baltimore, MD', 'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ',
      'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA', 'Kansas City, MO',
      'Mesa, AZ', 'Virginia Beach, VA', 'Atlanta, GA', 'New Orleans, LA',
      'Cleveland, OH', 'Arlington, TX', 'Miami, FL', 'Minneapolis, MN',
      'Tulsa, OK', 'Wichita, KS', 'Santa Ana, CA', 'Anaheim, CA',
      'Aurora, CO', 'Tampa, FL'
    ]

    MAJOR_CITIES.forEach(city => citySet.add(city))

    return Array.from(citySet).sort()
  } catch (error) {
    console.error('Failed to get all US cities:', error)
    // Return major cities as fallback
    return [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA',
      'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL',
      'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA',
      'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Boston, MA'
    ]
  }
}
