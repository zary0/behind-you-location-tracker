import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Request size validation
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    const { image } = await request.json()
    
    // Input validation
    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Invalid image data' },
        { status: 400 }
      );
    }

    // Validate base64 format and size
    try {
      const buffer = Buffer.from(image, 'base64');
      if (buffer.length > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: 'Image too large' },
          { status: 413 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Gemini 2.0 Flash Exp (vision capable model)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
      }
    })

    const prompt = `この画像を分析して、可能な限り具体的な場所を特定してください。
    
レスポンスは必ず以下のJSON形式で返してください：
{
  "latitude": 緯度（数値）,
  "longitude": 経度（数値）, 
  "description": "場所の説明",
  "confidence": 信頼度（0-1の数値）,
  "landmarks": ["認識したランドマーク1", "ランドマーク2"]
}

もし具体的な場所が特定できない場合は、最も可能性の高い地域の中心座標を返してください。
建物や看板の文字、特徴的な風景などから推測してください。`

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    }

    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    const text = response.text()

    // Remove sensitive logging in production
    if (process.env.NODE_ENV === 'development') {
      console.log('Gemini response:', text);
    }

    // JSONレスポンスを抽出
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const locationData = JSON.parse(jsonMatch[0])
        return NextResponse.json(locationData)
      } else {
        // JSONが見つからない場合はデフォルト値を返す
        return NextResponse.json({
          latitude: 35.6762,
          longitude: 139.6503,
          description: "場所を特定できませんでした（東京駅をデフォルト表示）",
          confidence: 0.1,
          landmarks: [],
          rawResponse: text
        })
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({
        latitude: 35.6762,
        longitude: 139.6503,
        description: "レスポンス解析エラー（東京駅をデフォルト表示）",
        confidence: 0.1,
        landmarks: [],
        rawResponse: text
      })
    }

  } catch (error) {
    console.error('Error analyzing image:', error)
    return NextResponse.json(
      { error: 'Image analysis failed. Please try again.' },
      { status: 500 }
    )
  }
}