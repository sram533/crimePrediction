'use client'

import { useEffect, useRef } from 'react'
import type { LatLngExpression } from 'leaflet'

interface MapProps {
  center: LatLngExpression
  zoom?: number
  children?: React.ReactNode
}

interface MapTileLayerProps {}

interface MapCircleProps {
  center: LatLngExpression
  radius: number
}

// Convert lat/lng to tile coordinates
function lngLatToTile(lng: number, lat: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = ((lng + 180) / 360) * n
  const y =
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n
  return { x, y, zoom }
}

// Get OpenStreetMap tile URL
function getTileUrl(x: number, y: number, z: number) {
  return `https://tile.openstreetmap.org/${z}/${Math.floor(x)}/${Math.floor(y)}.png`
}

// Calculate screen coordinates from lat/lng
function latLngToScreenCoords(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  tileSize: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const centerTile = lngLatToTile(centerLng, centerLat, zoom)
  const pointTile = lngLatToTile(lng, lat, zoom)

  const x = (pointTile.x - centerTile.x) * tileSize + canvasWidth / 2
  const y = (pointTile.y - centerTile.y) * tileSize + canvasHeight / 2

  return { x, y }
}

export function Map({ center, zoom = 16, children }: MapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const tileSize = 256
    const lat = Array.isArray(center) ? center[0] : center.lat
    const lng = Array.isArray(center) ? center[1] : center.lng

    const centerTile = lngLatToTile(lng, lat, zoom)
    const startTileX = Math.floor(centerTile.x) - 1
    const startTileY = Math.floor(centerTile.y) - 1
    const tilesNeeded = Math.ceil(Math.max(canvas.width, canvas.height) / tileSize) + 1

    // Draw background
    ctx.fillStyle = '#f0ede5'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw tiles
    const imagePromises: Promise<void>[] = []

    for (let dx = 0; dx < tilesNeeded; dx++) {
      for (let dy = 0; dy < tilesNeeded; dy++) {
        const tileX = startTileX + dx
        const tileY = startTileY + dy
        const url = getTileUrl(tileX, tileY, zoom)

        const promise = new Promise<void>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const screenX = (tileX - centerTile.x) * tileSize + canvas.width / 2
            const screenY = (tileY - centerTile.y) * tileSize + canvas.height / 2
            ctx.drawImage(img, screenX, screenY, tileSize, tileSize)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = url
        })

        imagePromises.push(promise)
      }
    }

    // Draw UI overlay after tiles load
    Promise.all(imagePromises).then(() => {
      // Draw semi-transparent overlay for better visibility
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw crime prediction radius circle
      const radiusMeters = 600
      const metersPerPixelAtZoom = (40075017 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8)
      const radiusPixels = radiusMeters / metersPerPixelAtZoom

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      // Draw filled circle with transparency
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2)
      ctx.fill()

      // Draw circle border
      ctx.strokeStyle = 'rgb(255, 255, 255)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2)
      ctx.stroke()

      // Draw center marker
      ctx.fillStyle = 'rgb(255, 255, 255)'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgb(239, 68, 68)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2)
      ctx.stroke()
    })
  }, [center, zoom])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-grab"
    />
  )
}

export function MapTileLayer() {
  return null
}

export function MapCircle({ center, radius }: MapCircleProps) {
  return null
}
