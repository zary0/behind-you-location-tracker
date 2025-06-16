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
    
    // Gemini 2.0 Flash with Google Search grounding
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
      tools: [
        {
          googleSearch: {}
        }
      ]
    })

    const prompt = `この画像を詳細に分析して、場所を特定してください。

分析手順：
1. 画像内の視覚的手がかりを特定（建物、看板、ランドマーク、文字、風景特徴など）
2. 特定したランドマークや特徴的な要素についてGoogle検索で最新情報を取得
3. 検索結果と画像解析を組み合わせて正確な位置を特定
4. 座標の精度と信頼性を評価

特に以下の要素に注目：
- 建築物の特徴的なデザイン
- 看板や標識の文字情報
- 地理的な特徴（山、川、海など）
- 文化的・歴史的なランドマーク
- 都市計画や道路パターン

最終的に以下のJSON形式で返してください：
{
  "latitude": 緯度（数値）,
  "longitude": 経度（数値）,
  "description": "場所の詳細説明",
  "confidence": 信頼度（0-1の数値）,
  "landmarks": ["認識したランドマーク1", "ランドマーク2"],
  "search_queries_used": ["使用した検索クエリ1", "クエリ2"],
  "grounding_sources": ["参照したソース1", "ソース2"],
  "analysis_method": "grounded_search"
}

画像に写っている特徴を基に、Google検索で確認しながら最も正確な位置を特定してください。`

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Starting grounded analysis with Google Search...');
    }
    
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    const text = response.text()

    // Remove sensitive logging in production
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Grounded response received:', text);
    }

    // Grounding metadata の取得
    const usageMetadata = response.usageMetadata
    const candidates = response.candidates
    
    let groundingMetadata = null
    let searchQueries: string[] = []
    let groundingSources: string[] = []

    if (candidates && candidates.length > 0) {
      const candidate = candidates[0]
      if (candidate.groundingMetadata) {
        groundingMetadata = candidate.groundingMetadata
        
        // 検索クエリの抽出
        if (groundingMetadata.webSearchQueries) {
          searchQueries = groundingMetadata.webSearchQueries
        }
        
        // Grounding sourcesの抽出
        if (groundingMetadata.groundingSupports) {
          groundingSources = groundingMetadata.groundingSupports.map((support: any) => {
            if (support.segment && support.segment.text) {
              return support.segment.text
            }
            return JSON.stringify(support)
          })
        }
      }
    }

    // JSONレスポンスを抽出
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const locationData = JSON.parse(jsonMatch[0])
        
        // Grounding情報を追加
        locationData.search_queries_used = searchQueries
        locationData.grounding_sources = groundingSources
        locationData.grounding_metadata = groundingMetadata
        locationData.analysis_method = "grounded_search"
        
        return NextResponse.json(locationData)
      } else {
        // JSONが見つからない場合
        return NextResponse.json({
          latitude: 35.6762,
          longitude: 139.6503,
          description: "場所を特定できませんでした（グラウンディング検索実行済み）",
          confidence: 0.1,
          landmarks: [],
          search_queries_used: searchQueries,
          grounding_sources: groundingSources,
          analysis_method: "grounded_search",
          grounding_metadata: groundingMetadata,
          rawResponse: text
        })
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({
        latitude: 35.6762,
        longitude: 139.6503,
        description: "レスポンス解析エラー（グラウンディング検索実行済み）",
        confidence: 0.1,
        landmarks: [],
        search_queries_used: searchQueries,
        grounding_sources: groundingSources,
        analysis_method: "grounded_search",
        grounding_metadata: groundingMetadata,
        rawResponse: text
      })
    }

  } catch (error) {
    console.error('Error in grounded analysis:', error)
    return NextResponse.json(
      { error: 'Grounded image analysis failed. Please try again.' },
      { status: 500 }
    )
  }
}