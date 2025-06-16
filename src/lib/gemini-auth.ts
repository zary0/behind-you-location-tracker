// Gemini API関連の関数

// 基本的な画像解析
export async function analyzeLocationFromImage(imageData: string) {
  try {
    const response = await fetch('/api/analyze-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error in analyzeLocationFromImage:', error)
    throw error
  }
}

// Function calling を使用した画像解析
export async function analyzeLocationFromImageWithSearch(imageData: string) {
  try {
    const response = await fetch('/api/analyze-location-with-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error in analyzeLocationFromImageWithSearch:', error)
    throw error
  }
}

// Google Search grounding を使用した画像解析
export async function analyzeLocationFromImageWithGrounding(imageData: string) {
  try {
    const response = await fetch('/api/analyze-location-grounded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error in analyzeLocationFromImageWithGrounding:', error)
    throw error
  }
}

// 画像検索
export async function searchSimilarImages(imageData: string) {
  try {
    const response = await fetch('/api/image-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error in searchSimilarImages:', error)
    throw error
  }
}