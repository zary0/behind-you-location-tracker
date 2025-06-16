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
    
    // Gemini 2.0 Flash with Google Search grounding for image search
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

    const prompt = `この画像を分析して、類似の画像や関連する情報をGoogle検索で見つけてください。

分析手順：
1. 画像内の主要な要素を特定（人物、物体、建物、ランドマーク、商品など）
2. 特徴的な要素について詳細な検索クエリを生成
3. Google検索で類似画像や関連情報を検索
4. 検索結果から有用な情報を抽出

以下のJSON形式でレスポンスを返してください：
{
  "image_description": "画像の詳細な説明",
  "detected_objects": ["検出された物体1", "物体2"],
  "search_queries": ["生成された検索クエリ1", "クエリ2"],
  "similar_images": [
    {
      "title": "類似画像のタイトル",
      "url": "画像のURL",
      "source": "ソースサイト",
      "description": "画像の説明"
    }
  ],
  "related_information": [
    {
      "title": "関連情報のタイトル",
      "url": "リンクURL", 
      "snippet": "要約"
    }
  ],
  "visual_elements": {
    "colors": ["主要な色1", "色2"],
    "style": "画像のスタイル（写真、イラスト、アート等）",
    "composition": "構図の説明"
  },
  "possible_sources": ["この画像の可能性のある出典1", "出典2"],
  "suggestions": ["関連する検索提案1", "提案2"]
}

画像の内容を詳しく分析し、関連する情報を包括的に検索してください。`

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Starting image search analysis...');
    }
    
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    const text = response.text()

    // Remove sensitive logging in production
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Image search response received:', text);
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
        const imageSearchData = JSON.parse(jsonMatch[0])
        
        // Search metadata を追加
        imageSearchData.search_metadata = {
          search_queries_used: searchQueries,
          grounding_sources: groundingSources,
          grounding_metadata: groundingMetadata
        }
        
        return NextResponse.json(imageSearchData)
      } else {
        // JSONが見つからない場合
        return NextResponse.json({
          image_description: "画像の分析に失敗しました",
          detected_objects: [],
          search_queries: searchQueries,
          similar_images: [],
          related_information: [],
          visual_elements: {
            colors: [],
            style: "unknown",
            composition: "分析できませんでした"
          },
          possible_sources: [],
          suggestions: [],
          search_metadata: {
            search_queries_used: searchQueries,
            grounding_sources: groundingSources,
            grounding_metadata: groundingMetadata
          },
          rawResponse: text
        })
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({
        image_description: "JSON解析エラー",
        detected_objects: [],
        search_queries: searchQueries,
        similar_images: [],
        related_information: [],
        visual_elements: {
          colors: [],
          style: "unknown",
          composition: "解析エラー"
        },
        possible_sources: [],
        suggestions: [],
        search_metadata: {
          search_queries_used: searchQueries,
          grounding_sources: groundingSources,
          grounding_metadata: groundingMetadata
        },
        rawResponse: text
      })
    }

  } catch (error) {
    console.error('Error in image search:', error)
    return NextResponse.json(
      { error: 'Image search failed. Please try again.' },
      { status: 500 }
    )
  }
}