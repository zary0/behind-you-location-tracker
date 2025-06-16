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
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRealTimeMode, setIsRealTimeMode] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null)
  const [searchMode, setSearchMode] = useState<'basic' | 'function' | 'grounding' | 'image-search'>('grounding')
  const [isImageSearching, setIsImageSearching] = useState(false)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          frameRate: { ideal: 10, max: 15 }
        } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Camera access denied or not available')
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) {
      return
    }

    setIsAnalyzing(true)
    
    try {
      const canvas = canvasRef.current
      const video = videoRef.current
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        setIsAnalyzing(false)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      // 画像をbase64エンコード
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      const base64Data = imageData.split(',')[1]
      
      // Gemini APIで画像を解析（検索モードに応じて）
      const result = searchMode === 'grounding' 
        ? await analyzeLocationFromImageWithGrounding(base64Data)
        : searchMode === 'function' 
        ? await analyzeLocationFromImageWithSearch(base64Data)
        : await analyzeLocationFromImage(base64Data)
      
      if (result.latitude && result.longitude) {
        onLocationDetected({
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.description || '不明な場所',
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error analyzing image:', error)
      // リアルタイムモードでは静かにエラーを処理
      if (!isRealTimeMode) {
        alert('画像解析中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー'))
      }
    } finally {
      setIsAnalyzing(false)
      
      // リアルタイムモードの場合、次のフレームを解析
      if (isRealTimeMode && stream) {
        setTimeout(() => {
          captureAndAnalyze()
        }, 100) // 100ms後に次のフレームを解析
      }
    }
  }, [isAnalyzing, setIsAnalyzing, onLocationDetected, isRealTimeMode, stream])

  // リアルタイムモードの開始/停止
  const toggleRealTimeMode = useCallback(() => {
    if (isRealTimeMode) {
      // リアルタイムモード停止
      setIsRealTimeMode(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      // リアルタイムモード開始
      if (!stream || isAnalyzing) {
        alert('カメラを開始してから実行してください')
        return
      }
      
      setIsRealTimeMode(true)
      captureAndAnalyze() // 最初の推論を開始
    }
  }, [isRealTimeMode, stream, isAnalyzing, captureAndAnalyze])

  // 画像寸法を取得する関数
  const getImageDimensions = useCallback((imageSrc: string) => {
    return new Promise<{width: number, height: number}>((resolve, reject) => {
      // SSR環境チェック
      if (typeof window === 'undefined') {
        resolve({ width: 400, height: 300 }) // デフォルト値
        return
      }
      
      try {
        const img = new window.Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => {
          resolve({ width: 400, height: 300 }) // エラー時のデフォルト値
        }
        img.src = imageSrc
      } catch (error) {
        resolve({ width: 400, height: 300 }) // エラー時のデフォルト値
      }
    })
  }, [])

  // ファイル処理ロジック
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }

    // FileReader サポートチェック
    if (!window.FileReader) {
      alert('お使いのブラウザはファイルアップロードをサポートしていません')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = e.target?.result as string
        if (!result) return

        setUploadedImage(result)
        
        // 画像の寸法を取得
        try {
          const dimensions = await getImageDimensions(result)
          setImageDimensions(dimensions)
        } catch (error) {
          console.warn('Failed to get image dimensions:', error)
          setImageDimensions({ width: 400, height: 300 })
        }
        
        // 画像をアップロードしたらカメラを停止
        if (stream) {
          stopCamera()
        }
        
        // リアルタイムモードも停止
        if (isRealTimeMode) {
          setIsRealTimeMode(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (error) {
        console.error('Error processing file:', error)
        alert('ファイルの処理中にエラーが発生しました')
      }
    }
    
    reader.onerror = () => {
      alert('ファイルの読み込み中にエラーが発生しました')
    }
    
    reader.readAsDataURL(file)
  }, [stream, isRealTimeMode, stopCamera, getImageDimensions])

  // 画像ファイルアップロード処理
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof window === 'undefined') return
    
    const file = event.target.files?.[0]
    if (!file) return

    processImageFile(file)
  }, [processImageFile])

  // アップロードされた画像を解析
  const analyzeUploadedImage = useCallback(async () => {
    if (!uploadedImage || isAnalyzing) return

    setIsAnalyzing(true)
    
    try {
      // base64データから画像データ部分を抽出
      const base64Data = uploadedImage.split(',')[1]
      
      // Gemini APIで画像を解析（検索モードに応じて）
      const result = searchMode === 'grounding' 
        ? await analyzeLocationFromImageWithGrounding(base64Data)
        : searchMode === 'function' 
        ? await analyzeLocationFromImageWithSearch(base64Data)
        : await analyzeLocationFromImage(base64Data)
      
      if (result.latitude && result.longitude) {
        onLocationDetected({
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.description || '不明な場所',
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error analyzing uploaded image:', error)
      alert('画像解析中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー'))
    } finally {
      setIsAnalyzing(false)
    }
  }, [uploadedImage, isAnalyzing, setIsAnalyzing, onLocationDetected, searchMode])

  // アップロードされた画像の画像検索
  const searchUploadedImage = useCallback(async () => {
    if (!uploadedImage || isImageSearching) return

    setIsImageSearching(true)
    
    try {
      // base64データから画像データ部分を抽出
      const base64Data = uploadedImage.split(',')[1]
      
      // Gemini APIで画像検索
      const result = await searchSimilarImages(base64Data)
      
      if (onImageSearchResult) {
        onImageSearchResult(result)
      }
    } catch (error) {
      console.error('Error searching uploaded image:', error)
      alert('画像検索中にエラーが発生しました: ' + (error instanceof Error ? error.message : '不明なエラー'))
    } finally {
      setIsImageSearching(false)
    }
  }, [uploadedImage, isImageSearching, onImageSearchResult])

  // ファイル選択をトリガー
  const triggerFileUpload = useCallback(() => {
    if (typeof window === 'undefined') return
    fileInputRef.current?.click()
  }, [])

  // アップロード画像をクリア
  const clearUploadedImage = useCallback(() => {
    setUploadedImage(null)
    setImageDimensions(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // ドラッグ&ドロップハンドラー
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (typeof window === 'undefined') return
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (!imageFile) return
    
    processImageFile(imageFile)
  }, [processImageFile])

  // 最適な表示高さを計算
  const getOptimalHeight = useCallback(() => {
    if (!imageDimensions) return 480 // デフォルト高さ

    // SSR環境チェック
    if (typeof window === 'undefined') return 480

    // 画面サイズに応じてコンテナ幅を動的に調整
    const isMobile = window.innerWidth < 768
    const containerWidth = isMobile ? window.innerWidth - 80 : 500
    const aspectRatio = imageDimensions.width / imageDimensions.height
    
    // アスペクト比に基づいて最適な高さを計算
    let height = containerWidth / aspectRatio
    
    // デバイスに応じて最小・最大高さを制限
    const minHeight = 320
    const maxHeight = 600
    height = Math.max(minHeight, Math.min(maxHeight, height))
    
    return height
  }, [imageDimensions])

  useEffect(() => {
    return () => {
      stopCamera()
      setIsRealTimeMode(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              bgcolor: 'primary.main', 
              borderRadius: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <VideoIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" component="h2">
              Camera Analysis
            </Typography>
          </Box>
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
              <ToggleButton value="basic">Basic</ToggleButton>
              <ToggleButton value="function">Function</ToggleButton>
              <ToggleButton value="grounding">Grounding</ToggleButton>
              <ToggleButton value="image-search">Image Search</ToggleButton>
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
              <IconButton onClick={onToggleVisibility} size="small">
                <EyeOffIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardHeader>

      <CardContent>
        {/* Camera/Upload Area */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '2px dashed',
            borderColor: isDragOver ? 'primary.main' : 'divider',
            bgcolor: isDragOver ? 'primary.50' : 'background.default',
            transition: 'all 0.3s ease',
            height: `${getOptimalHeight()}px`,
            minHeight: '320px',
            maxHeight: '600px'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploadedImage ? (
            <Box component="img"
              src={uploadedImage}
              alt="Uploaded image"
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <>
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box
                component="canvas"
                ref={canvasRef}
                sx={{ display: 'none' }}
              />
              {!stream && (
                <Box sx={{ 
                  position: 'absolute', 
                  inset: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'text.secondary'
                }}>
                  <Box sx={{ 
                    width: 80, 
                    height: 80, 
                    bgcolor: 'background.paper', 
                    borderRadius: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    mb: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <CameraIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Camera not started
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'center', maxWidth: 300 }}>
                    Start camera, upload, or drag & drop an image to begin analysis
                  </Typography>
                </Box>
              )}
            </>
          )}
          
          {isAnalyzing && (
            <Box sx={{ 
              position: 'absolute', 
              inset: 0, 
              bgcolor: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(4px)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Analyzing with AI...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Please wait while we detect the location
                </Typography>
              </Box>
            </Box>
          )}

          {isDragOver && (
            <Box sx={{ 
              position: 'absolute', 
              inset: 0, 
              bgcolor: 'rgba(59, 130, 246, 0.1)', 
              backdropFilter: 'blur(4px)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: '2px dashed',
              borderColor: 'primary.main'
            }}>
              <Box sx={{ textAlign: 'center', color: 'primary.main' }}>
                <UploadIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  Drop image here
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Release to upload and analyze
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Control Buttons */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 3 }}>
          {!uploadedImage ? (
            <>
              <Button onClick={startCamera} disabled={!!stream} variant="contained" startIcon={<CameraIcon />}>
                Start Camera
              </Button>
              <Button onClick={stopCamera} disabled={!stream} variant="outlined" startIcon={<SquareIcon />}>
                Stop Camera
              </Button>
              <Button
                onClick={toggleRealTimeMode}
                disabled={!stream}
                variant="contained"
                color={isRealTimeMode ? "error" : "success"}
                startIcon={isRealTimeMode ? <PauseIcon /> : <PlayIcon />}
              >
                {isRealTimeMode ? "Stop Live" : "Start Live"}
              </Button>
              <Button
                onClick={captureAndAnalyze}
                disabled={!stream || isAnalyzing || isRealTimeMode}
                variant="contained"
                color="secondary"
                startIcon={isAnalyzing ? <CircularProgress size={16} /> : <CameraIcon />}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Frame"}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={analyzeUploadedImage}
                disabled={isAnalyzing || searchMode === 'image-search'}
                variant="contained"
                startIcon={isAnalyzing ? <CircularProgress size={16} /> : <ImageIcon />}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Location"}
              </Button>
              <Button
                onClick={searchUploadedImage}
                disabled={isImageSearching || searchMode !== 'image-search'}
                variant="contained"
                color="secondary"
                startIcon={isImageSearching ? <CircularProgress size={16} /> : <SearchIcon />}
              >
                {isImageSearching ? "Searching..." : "Search Similar"}
              </Button>
              <Button onClick={clearUploadedImage} variant="outlined" startIcon={<SquareIcon />}>
                Clear Image
              </Button>
            </>
          )}
          <Button onClick={triggerFileUpload} disabled={isAnalyzing} variant="outlined" startIcon={<UploadIcon />}>
            Upload Image
          </Button>
        </Box>

        {/* Status Display */}
        <Box sx={{ mt: 3 }}>
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
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Status:</Typography>
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