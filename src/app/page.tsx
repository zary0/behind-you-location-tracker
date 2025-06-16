'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Chip, 
  Button, 
  Box, 
  Container,
  Grid,
  Divider
} from '@mui/material'
import {
  LocationOn as MapPinIcon,
  PhotoCamera as CameraIcon,
  Public as GlobeIcon
} from '@mui/icons-material'
import CameraCapture from '@/components/CameraCapture'
import LocationMap from '@/components/LocationMap'

interface LocationData {
  latitude: number
  longitude: number
  description: string
  timestamp: Date
}

export default function Home() {
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCameraVisible, setIsCameraVisible] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [imageSearchResult, setImageSearchResult] = useState<any>(null)

  const handleLocationDetected = (location: LocationData) => {
    setLocationHistory(prev => [...prev, location])
  }

  const handleImageSearchResult = (searchData: any) => {
    setImageSearchResult(searchData)
  }

  const toggleCameraVisibility = () => {
    setIsCameraVisible(prev => !prev)
  }

  useEffect(() => {
    setIsMounted(true)
    
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // SSR時のレンダリング防止
  if (!isMounted) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(to bottom right, #f0f9ff, #e0e7ff)',
        fontFamily: '"Space Grotesk", "Noto Sans", sans-serif'
      }}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
              <Box sx={{ 
                width: 48, 
                height: 48, 
                bgcolor: 'primary.main', 
                borderRadius: 3, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: 2
              }}>
                <GlobeIcon sx={{ fontSize: 24, color: 'white' }} />
              </Box>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                ReverseGeo
              </Typography>
            </Box>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
              その一枚から、世界を探し出すAI
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="primary.main">Loading...</Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(to bottom right, #f0f9ff, #e0e7ff)',
      fontFamily: '"Space Grotesk", "Noto Sans", sans-serif'
    }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
            <Box sx={{ 
              width: 48, 
              height: 48, 
              bgcolor: 'primary.main', 
              borderRadius: 3, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: 2,
              flexShrink: 0
            }}>
              <GlobeIcon sx={{ fontSize: 24, color: 'white' }} />
            </Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              ReverseGeo
            </Typography>
          </Box>
          <Typography variant="h6" color="text.secondary">
            その一枚から、世界を探し出すAI
          </Typography>
        </Box>

        {/* Main Content */}
        <Box sx={{ maxWidth: '1400px', mx: 'auto', display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Left Panel - Map (70%) */}
          <Box sx={{ flex: isCameraVisible ? '0 0 70%' : '1 1 100%', minWidth: 0 }}>
            <LocationMap locations={locationHistory} />
            
            {/* Show Camera Button when hidden */}
            {!isCameraVisible && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button
                  onClick={toggleCameraVisibility}
                  variant="contained"
                  size="large"
                  startIcon={<CameraIcon />}
                  sx={{ boxShadow: 3 }}
                >
                  Show Camera
                </Button>
              </Box>
            )}
          </Box>
          
          {/* Right Panel - Camera/Upload (30%) */}
          {isCameraVisible && (
            <Box sx={{ flex: '0 0 30%', minWidth: 0 }}>
              <CameraCapture 
                onLocationDetected={handleLocationDetected}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                isVisible={isCameraVisible}
                onToggleVisibility={toggleCameraVisibility}
                onImageSearchResult={handleImageSearchResult}
              />
            </Box>
          )}
        </Box>

        {/* Recent Detections */}
        {locationHistory.length > 0 && (
          <Box sx={{ mt: 6, maxWidth: '800px', mx: 'auto' }}>
            <Card>
              <CardHeader sx={{ 
                background: 'linear-gradient(to right, #3b82f6, #6366f1)',
                color: 'white'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{
                      width: 32,
                      height: 32,
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MapPinIcon sx={{ fontSize: 20, color: 'white' }} />
                    </Box>
                    <Typography variant="h6" sx={{ color: 'white' }}>
                      Recent Detections
                    </Typography>
                  </Box>
                  <Chip 
                    label={locationHistory.length}
                    sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.2)', 
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                    size="small"
                  />
                </Box>
              </CardHeader>
              
              <CardContent>
                <Box sx={{ 
                  display: 'grid', 
                  gap: 2, 
                  maxHeight: 320, 
                  overflow: 'auto' 
                }}>
                  {locationHistory.slice(-5).reverse().map((location, index) => (
                    <Card key={index} sx={{ 
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { boxShadow: 2 },
                      transition: 'box-shadow 0.2s'
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                              {location.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                🕒 {location.timestamp.toLocaleTimeString()}
                              </Typography>
                            </Box>
                            
                            {/* Analysis Method */}
                            {(location as any)?.analysis_method && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                                <Box sx={{
                                  width: 16,
                                  height: 16,
                                  bgcolor: 'success.main',
                                  borderRadius: 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <Typography sx={{ fontSize: 10, color: 'white' }}>🔍</Typography>
                                </Box>
                                <Chip
                                  label={
                                    (location as any).analysis_method === 'grounded_search' ? 'Google Search Grounding' :
                                    (location as any).analysis_method === 'function_calling' ? 'Function Calling' : 
                                    'Basic Analysis'
                                  }
                                  color="success"
                                  variant="outlined"
                                  size="small"
                                />
                                {(location as any)?.confidence && (
                                  <Typography variant="caption" color="text.secondary">
                                    Confidence: {Math.round((location as any).confidence * 100)}%
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                          <Chip 
                            label={`#${locationHistory.length - index}`}
                            variant="outlined"
                            size="small"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
      </Container>
    </Box>
  )
}