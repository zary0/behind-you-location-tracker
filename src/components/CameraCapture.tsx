'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { analyzeLocationFromImage, analyzeLocationFromImageWithSearch, analyzeLocationFromImageWithGrounding, searchSimilarImages } from '@/lib/gemini-auth'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Chip, 
  Button, 
  Box, 
  CircularProgress,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  IconButton
} from '@mui/material'
import {
  PhotoCamera as CameraIcon,
  Stop as SquareIcon,
  Videocam as VideoIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Upload as UploadIcon,
  Image as ImageIcon,
  VisibilityOff as EyeOffIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import ImageSearchResults from '@/components/ImageSearchResults'

interface LocationData {
  latitude: number
  longitude: number
  description: string
  timestamp: Date
}

interface CameraCaptureProps {
  onLocationDetected: (location: LocationData) => void
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void
  isVisible?: boolean
  onToggleVisibility?: () => void
  onImageSearchResult?: (searchData: any) => void
}

export default function CameraCapture({ 
  onLocationDetected, 
  isAnalyzing, 
  setIsAnalyzing,
  isVisible = true,
  onToggleVisibility,
  onImageSearchResult
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRealTimeMode, setIsRealTimeMode] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null)
  const [searchMode, setSearchMode] = useState<'basic' | 'function' | 'grounding' | 'image-search'>('basic')
  const [analysisResults, setAnalysisResults] = useState<string | null>(null)
  const [imageSearchResults, setImageSearchResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'environment'
        } 
      })
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('カメラへのアクセスに失敗しました。権限を確認してください。')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsRealTimeMode(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [stream])

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    if (!context) return null
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  const captureAndAnalyze = useCallback(async () => {
    const imageData = captureImage()
    if (!imageData) {
      setError('画像のキャプチャに失敗しました')
      return
    }
    
    await analyzeImage(imageData)
  }, [captureImage])

  const analyzeImage = useCallback(async (imageData: string) => {
    if (isAnalyzing) return
    
    setIsAnalyzing(true)
    setError(null)
    
    try {
      let result
      
      switch (searchMode) {
        case 'function':
          result = await analyzeLocationFromImageWithSearch(imageData)
          break
        case 'grounding':
          result = await analyzeLocationFromImageWithGrounding(imageData)
          break
        case 'image-search':
          const searchResults = await searchSimilarImages(imageData)
          setImageSearchResults(searchResults)
          if (onImageSearchResult) {
            onImageSearchResult(searchResults)
          }
          // Fall through to basic analysis for location data
          result = await analyzeLocationFromImage(imageData)
          break
        default: // basic
          result = await analyzeLocationFromImage(imageData)
          break
      }
      
      if (result && result.latitude && result.longitude) {
        const locationData: LocationData = {
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.description || 'Location detected from image analysis',
          timestamp: new Date()
        }
        onLocationDetected(locationData)
        setAnalysisResults(`Location: ${result.description}\nCoordinates: ${result.latitude}, ${result.longitude}`)
      } else {
        setError('位置情報を特定できませんでした')
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError('分析中にエラーが発生しました')
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, searchMode, onLocationDetected, onImageSearchResult])

  const toggleRealTimeMode = useCallback(() => {
    if (!stream) return
    
    setIsRealTimeMode(prev => {
      const newMode = !prev
      if (newMode) {
        // Start real-time analysis (capture every 3 seconds)
        const interval = setInterval(() => {
          if (!isAnalyzing) {
            captureAndAnalyze()
          }
        }, 3000)
        
        // Store interval ID for cleanup
        setTimeout(() => {
          const currentInterval = interval
          if (currentInterval) {
            clearInterval(currentInterval)
          }
        }, 30000) // Stop after 30 seconds
      }
      return newMode
    })
  }, [stream, isAnalyzing, captureAndAnalyze])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setUploadedImage(result)
      
      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
      }
      img.src = result
      
      // Clear previous results
      setAnalysisResults(null)
      setImageSearchResults(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const analyzeUploadedImage = useCallback(async () => {
    if (!uploadedImage) return
    await analyzeImage(uploadedImage)
  }, [uploadedImage, analyzeImage])

  const searchUploadedImage = useCallback(async () => {
    if (!uploadedImage) return
    
    setIsAnalyzing(true)
    setError(null)
    
    try {
      const searchResults = await searchSimilarImages(uploadedImage)
      setImageSearchResults(searchResults)
      if (onImageSearchResult) {
        onImageSearchResult(searchResults)
      }
    } catch (err) {
      console.error('Image search error:', err)
      setError('画像検索中にエラーが発生しました')
    } finally {
      setIsAnalyzing(false)
    }
  }, [uploadedImage, onImageSearchResult])

  const clearUploadedImage = useCallback(() => {
    setUploadedImage(null)
    setImageDimensions(null)
    setAnalysisResults(null)
    setImageSearchResults(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  if (!isVisible) {
    return null
  }

  return (
    <Card sx={{ 
      mb: 3, 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      '& .MuiCardContent-root': {
        background: 'rgba(255, 255, 255, 0.95)',
        color: 'inherit',
        borderRadius: 2
      }
    }}>
      <CardHeader 
        sx={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        }}
        title={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h6" component="h2">
              Camera Analysis
            </Typography>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              value={searchMode}
              exclusive
              onChange={(event: React.MouseEvent<HTMLElement>, newMode: string | null) => {
                if (newMode && ['basic', 'function', 'grounding', 'image-search'].includes(newMode)) {
                  setSearchMode(newMode as 'basic' | 'function' | 'grounding' | 'image-search')
                }
              }}
              size="small"
            >
              <ToggleButton value="basic">
                Basic
              </ToggleButton>
              <ToggleButton value="function">
                Function
              </ToggleButton>
              <ToggleButton value="grounding">
                Grounding
              </ToggleButton>
              <ToggleButton value="image-search">
                Image Search
              </ToggleButton>
            </ToggleButtonGroup>
            <Chip 
              label={!stream ? "Offline" : isRealTimeMode ? "Live" : isAnalyzing ? "Analyzing" : "Ready"}
              color={
                !stream ? "default" :
                isRealTimeMode ? "success" :
                isAnalyzing ? "primary" :
                "warning"
              }
              variant="outlined"
              size="small"
            />
            {onToggleVisibility && (
              <IconButton
                onClick={onToggleVisibility}
                size="small"
              >
                <EyeOffIcon />
              </IconButton>
            )}
          </Box>
        }
      />
      <CardContent sx={{ color: 'text.primary' }}>
        {/* Upload Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            画像をアップロード
          </Typography>
          
          {uploadedImage ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ 
                position: 'relative', 
                maxWidth: '100%', 
                maxHeight: 400, 
                overflow: 'hidden',
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'primary.main'
              }}>
                <img 
                  src={uploadedImage} 
                  alt="Uploaded" 
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    maxHeight: 400, 
                    objectFit: 'contain' 
                  }} 
                />
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={analyzeUploadedImage}
                  disabled={isAnalyzing}
                  startIcon={isAnalyzing ? <CircularProgress size={16} /> : <SearchIcon />}
                  size="small"
                >
                  {isAnalyzing ? '分析中...' : '位置を分析'}
                </Button>
                
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={searchUploadedImage}
                  disabled={isAnalyzing}
                  startIcon={<ImageIcon />}
                  size="small"
                >
                  類似画像を検索
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  onClick={clearUploadedImage}
                  size="small"
                >
                  クリア
                </Button>
              </Box>
            </Box>
          ) : (
            <Button
              variant="outlined"
              color="primary"
              onClick={triggerFileUpload}
              startIcon={<UploadIcon />}
              fullWidth
            >
              画像を選択
            </Button>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Status Info */}
        <Box sx={{ mt: 3, space: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            gap: 1, 
            p: 2, 
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Status:
              </Typography>
              <Chip 
                label={
                  uploadedImage ? "Image uploaded" :
                  !stream ? "Camera offline" : 
                  isRealTimeMode ? "Live analysis active" :
                  isAnalyzing ? "Analyzing..." : 
                  "Camera ready"
                }
                color={
                  uploadedImage ? "secondary" :
                  !stream ? "default" : 
                  isRealTimeMode ? "success" :
                  isAnalyzing ? "primary" : 
                  "warning"
                }
                size="small"
              />
            </Box>
            <Chip 
              label={
                uploadedImage && imageDimensions ? `${imageDimensions.width}×${imageDimensions.height}` :
                uploadedImage ? "Image mode" : 
                stream ? `${videoRef.current?.videoWidth || 0}×${videoRef.current?.videoHeight || 0}` :
                "Ready to capture"
              }
              variant="outlined"
              size="small"
            />
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Search Mode Info */}
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            gap: 1, 
            p: 2, 
            background: 'linear-gradient(to right, #f0fdfa, #eff6ff)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Mode: {searchMode === 'grounding' ? 'Google Search Grounding' : 
                       searchMode === 'function' ? 'Function Calling' : 
                       searchMode === 'image-search' ? 'Image Search' : 
                       'Basic Analysis'}
              </Typography>
            </Box>
            <Chip 
              label="Mode Info"
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* Hidden file input */}
        <Box
          component="input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          sx={{ display: 'none' }}
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  )
}