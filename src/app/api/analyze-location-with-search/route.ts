import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Web検索機能の定義
const webSearchFunction = {
  name: "web_search",
  description: "Search the web for information about locations, landmarks, or places based on visual clues",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query based on visual elements like landmarks, text, signs, or architectural features"
      },
      location_hint: {
        type: "string", 
        description: "Any location hints from the image like country, city, or region"
      }
    },
    required: ["query"]
  }
}

// Web検索の実装
async function performWebSearch(query: string, locationHint?: string): Promise<string> {
  try {
    console.log(`🔍 Performing web search: "${query}" ${locationHint ? `(location hint: ${locationHint})` : ''}`)
    
    // 検索クエリを構築
    const searchQuery = locationHint ? `${query} ${locationHint} location coordinates` : `${query} location coordinates`
    
    // Note: In a production environment, you would integrate with a real search API
    // For now, we'll use a fallback approach with common landmarks
    console.log(`🔍 Simulating web search for: "${searchQuery}"`)
    
    // Simulate successful search results for demo purposes
    const simulatedResults = `
Web Search Results for "${searchQuery}":

1. Geographic Information
   - Query: ${query}
   - Location Context: ${locationHint || 'Global search'}
   - Landmark Database: Checking known landmarks and coordinates
   
2. Location Identification
   - Visual Analysis: Combining image features with search context
   - Coordinate Estimation: Using landmark databases and geographical features
   
3. Additional Context
   - Related Places: Similar landmarks and locations
   - Historical Information: Cultural and geographical significance
   
Search completed successfully. Proceeding with enhanced analysis.
    `
    
    return simulatedResults
  } catch (error) {
    console.error('Web search error:', error)
    return await fallbackLocationSearch(query, locationHint)
  }
}

// フォールバック検索関数
async function fallbackLocationSearch(query: string, locationHint?: string): Promise<string> {
  const commonLandmarks: Record<string, string> = {
    "tower": "Famous towers and their locations",
    "bridge": "Notable bridges worldwide", 
    "temple": "Religious buildings and temples",
    "station": "Major train stations globally",
    "tower bridge": "Tower Bridge, London, UK (51.5055, -0.0754)",
    "eiffel tower": "Eiffel Tower, Paris, France (48.8584, 2.2945)",
    "tokyo tower": "Tokyo Tower, Tokyo, Japan (35.6586, 139.7454)",
    "golden gate": "Golden Gate Bridge, San Francisco, USA (37.8199, -122.4783)",
    "sydney opera": "Sydney Opera House, Sydney, Australia (-33.8568, 151.2153)",
    "statue of liberty": "Statue of Liberty, New York, USA (40.6892, -74.0445)"
  }

  const lowerQuery = query.toLowerCase()
  for (const [landmark, info] of Object.entries(commonLandmarks)) {
    if (lowerQuery.includes(landmark)) {
      return `Landmark information: ${info}`
    }
  }

  return `Searching for: ${query}${locationHint ? ` in ${locationHint}` : ''}. Please analyze the image for visual clues.`
}

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
    
    // Function calling対応のGemini 2.0 Flash Exp
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
          functionDeclarations: [webSearchFunction]
        }
      ]
    })

    const prompt = `この画像を詳細に分析して、場所を特定してください。

以下の手順で分析してください：
1. 画像内の視覚的な手がかりを特定（建物、看板、文字、ランドマーク、風景など）
2. 必要に応じてweb_search関数を使用して追加情報を取得
3. 収集した情報を基に最も正確な位置を特定

最終的には以下のJSON形式で返してください：
{
  "latitude": 緯度（数値）,
  "longitude": 経度（数値）, 
  "description": "場所の詳細説明",
  "confidence": 信頼度（0-1の数値）,
  "landmarks": ["認識したランドマーク1", "ランドマーク2"],
  "search_used": true/false,
  "search_queries": ["使用した検索クエリ1", "クエリ2"]
}

視覚的手がかりから場所を推定し、必要に応じて検索機能を活用してください。`

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    }

    // 初回リクエスト
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response

    let finalResponse = response
    let searchQueries: string[] = []
    let searchUsed = false

    // Function callsがあるかチェック
    const functionCalls = response.functionCalls()
    if (functionCalls && functionCalls.length > 0) {
      console.log('🔧 Function calls detected:', functionCalls.length)
      
      const functionResponses = []
      
      for (const call of functionCalls) {
        if (call.name === 'web_search') {
          searchUsed = true
          const args = call.args as { query: string; location_hint?: string }
          searchQueries.push(args.query)
          
          console.log('🌐 Executing web search:', args)
          const searchResult = await performWebSearch(args.query, args.location_hint)
          
          functionResponses.push({
            functionResponse: {
              name: 'web_search',
              response: {
                content: searchResult
              }
            }
          })
        }
      }

      // Function responsesと共に再度生成
      if (functionResponses.length > 0) {
        console.log('🔄 Sending function responses back to Gemini')
        const finalResult = await model.generateContent([
          prompt,
          imagePart,
          {
            functionCall: functionCalls[0]
          },
          ...functionResponses
        ])
        finalResponse = finalResult.response
      }
    }

    const text = finalResponse.text()
    // Remove sensitive logging in production
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Final Gemini response:', text);
    }

    // JSONレスポンスを抽出
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const locationData = JSON.parse(jsonMatch[0])
        
        // 検索情報を追加
        locationData.search_used = searchUsed
        locationData.search_queries = searchQueries
        
        return NextResponse.json(locationData)
      } else {
        // JSONが見つからない場合
        return NextResponse.json({
          latitude: 35.6762,
          longitude: 139.6503,
          description: "場所を特定できませんでした（東京駅をデフォルト表示）",
          confidence: 0.1,
          landmarks: [],
          search_used: searchUsed,
          search_queries: searchQueries,
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
        search_used: searchUsed,
        search_queries: searchQueries,
        rawResponse: text
      })
    }

  } catch (error) {
    console.error('Error analyzing image with search:', error)
    return NextResponse.json(
      { error: 'Image analysis with search failed. Please try again.' },
      { status: 500 }
    )
  }
}