'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsAPI } from '@/lib/google-maps-loader'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Chip, 
  Button, 
  Box, 
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import { 
  Map as MapIcon, 
  Public as GlobeIcon, 
  ErrorOutline as AlertCircleIcon 
} from '@mui/icons-material'

interface LocationData {
  latitude: number
  longitude: number
  description: string
  timestamp: Date
}

interface LocationMapProps {
  locations: LocationData[]
}

declare global {
  interface Window {
    google: any
  }
  
  namespace JSX {
    interface IntrinsicElements {
      'gmp-map-3d': any
    }
  }
}

export default function LocationMap({ locations }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d')
  const [currentMap, setCurrentMap] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initMaps = async () => {
      try {
        await loadGoogleMapsAPI()
        setIsLoaded(true)
        setError(null)
      } catch (error) {
        console.error('Failed to load Google Maps:', error)
        setError('Failed to load Google Maps API')
      }
    }
    initMaps()
  }, [])

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return

    // Clear existing map
    mapRef.current.innerHTML = ''

    if (viewMode === '3d') {
      // Create 3D map using gmp-map-3d element
      const map3D = document.createElement('gmp-map-3d')
      map3D.setAttribute('mode', 'hybrid')
      map3D.setAttribute('center', '35.6762, 139.6503') // Tokyo Station
      map3D.setAttribute('range', '2000000')
      map3D.setAttribute('tilt', '67.5')
      map3D.setAttribute('heading', '0')
      map3D.style.width = '100%'
      map3D.style.height = '100%'
      
      mapRef.current.appendChild(map3D)
      setCurrentMap(map3D)
    } else {
      // Create 2D map
      if (window.google?.maps?.Map) {
        const map2D = new window.google.maps.Map(mapRef.current, {
          center: { lat: 35.6762, lng: 139.6503 },
          zoom: 10,
          mapTypeId: 'hybrid'
        })
        setCurrentMap(map2D)
      }
    }
  }, [isLoaded, viewMode])

  // Update map when locations change
  useEffect(() => {
    if (!currentMap || !locations.length) return

    if (viewMode === '2d' && window.google?.maps) {
      // Clear existing markers
      if (currentMap.markers) {
        currentMap.markers.forEach((marker: any) => marker.setMap(null))
      }
      currentMap.markers = []

      // Add markers for each location
      locations.forEach((location, index) => {
        const marker = new window.google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: currentMap,
          title: location.description,
          label: (index + 1).toString()
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: #1e293b;">${location.description}</h4>
              <p style="margin: 4px 0; color: #64748b; font-size: 14px;">
                📍 ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
              </p>
              <p style="margin: 4px 0; color: #64748b; font-size: 14px;">
                🕒 ${location.timestamp.toLocaleString()}
              </p>
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindow.open(currentMap, marker)
        })

        currentMap.markers.push(marker)
      })

      // Focus on latest location
      if (locations.length > 0) {
        const latest = locations[locations.length - 1]
        currentMap.setCenter({ lat: latest.latitude, lng: latest.longitude })
        currentMap.setZoom(15)
      }
    } else if (viewMode === '3d' && locations.length > 0) {
      // For 3D map, center on latest location
      const latest = locations[locations.length - 1]
      currentMap.setAttribute('center', `${latest.latitude}, ${latest.longitude}`)
      currentMap.setAttribute('range', '1000')
    }
  }, [currentMap, locations, viewMode])

  const latest = locations.length > 0 ? locations[locations.length - 1] : null

  return (
    <Card sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <CardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              bgcolor: 'success.main', 
              borderRadius: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <GlobeIcon sx={{ color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" component="h2">
                Location Map
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {locations.length} detection{locations.length !== 1 ? 's' : ''} found
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="2d">2D</ToggleButton>
              <ToggleButton value="3d">3D</ToggleButton>
            </ToggleButtonGroup>
            <Chip 
              label={isLoaded ? "Ready" : "Loading..."}
              color={isLoaded ? "success" : "default"}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
      </CardHeader>

      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
        {error ? (
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Alert severity="error" sx={{ maxWidth: 400 }}>
              <AlertTitle>Map Loading Error</AlertTitle>
              {error}
            </Alert>
          </Box>
        ) : !isLoaded ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Loading Google Maps...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we initialize the map
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box ref={mapRef} sx={{ flex: 1, minHeight: 400 }} />
        )}

        {/* Latest Detection Info */}
        {latest && (
          <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MapIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Latest Detection
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {latest.description}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  📍 {latest.latitude.toFixed(6)}, {latest.longitude.toFixed(6)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  🕒 {latest.timestamp.toLocaleString()}
                </Typography>
              </Box>
              
              {/* Analysis Method Info */}
              {(latest as any)?.analysis_method && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={
                        (latest as any).analysis_method === 'grounded_search' ? 'Google Search Grounding' :
                        (latest as any).analysis_method === 'function_calling' ? 'Function Calling' : 
                        'Basic Analysis'
                      }
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                    {(latest as any)?.confidence && (
                      <Chip
                        label={`${Math.round((latest as any).confidence * 100)}% confidence`}
                        color="success"
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>
                  
                  {/* Search Queries Used */}
                  {(latest as any)?.search_queries_used && (latest as any).search_queries_used.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Search queries used:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(latest as any).search_queries_used.map((query: string, index: number) => (
                          <Chip
                            key={index}
                            label={query}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  {/* Landmarks */}
                  {(latest as any)?.landmarks && (latest as any).landmarks.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Detected landmarks:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(latest as any).landmarks.map((landmark: string, index: number) => (
                          <Chip
                            key={index}
                            label={landmark}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}