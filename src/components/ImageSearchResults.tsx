'use client'

import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Chip, 
  Button, 
  Box, 
  Divider,
  Link
} from '@mui/material'
import { 
  Search as SearchIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Palette as PaletteIcon,
  Category as CategoryIcon
} from '@mui/icons-material'

interface ImageSearchData {
  image_description: string
  detected_objects: string[]
  search_queries: string[]
  similar_images: Array<{
    title: string
    url: string
    source: string
    description: string
  }>
  related_information: Array<{
    title: string
    url: string
    snippet: string
  }>
  visual_elements: {
    colors: string[]
    style: string
    composition: string
  }
  possible_sources: string[]
  suggestions: string[]
  search_metadata?: {
    search_queries_used: string[]
    grounding_sources: string[]
  }
}

interface ImageSearchResultsProps {
  searchData: ImageSearchData | null
}

export default function ImageSearchResults({ searchData }: ImageSearchResultsProps) {
  if (!searchData) {
    return (
      <Card>
        <CardHeader>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              bgcolor: 'info.main', 
              borderRadius: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <SearchIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" component="h2">
              Image Search Results
            </Typography>
          </Box>
        </CardHeader>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No search results available. Use "Image Search" mode to analyze an image.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              bgcolor: 'info.main', 
              borderRadius: 2, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <SearchIcon sx={{ color: 'white' }} />
            </Box>
            <Typography variant="h6" component="h2">
              Image Search Results
            </Typography>
          </Box>
          <Chip 
            label="AI Powered"
            color="info"
            variant="outlined"
            size="small"
          />
        </Box>
      </CardHeader>

      <CardContent>
        {/* Image Description */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            🔍 Image Description
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchData.image_description}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Detected Objects */}
        {searchData.detected_objects.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CategoryIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Detected Objects
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {searchData.detected_objects.map((object, index) => (
                <Chip
                  key={index}
                  label={object}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Visual Elements */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PaletteIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Visual Analysis
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>Style:</Typography>
              <Chip label={searchData.visual_elements.style} size="small" variant="outlined" />
            </Box>
            {searchData.visual_elements.colors.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>Colors:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {searchData.visual_elements.colors.map((color, index) => (
                    <Chip
                      key={index}
                      label={color}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  ))}
                </Box>
              </Box>
            )}
            {searchData.visual_elements.composition && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Composition:</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {searchData.visual_elements.composition}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Similar Images */}
        {searchData.similar_images.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ImageIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Similar Images Found
              </Typography>
              <Chip label={searchData.similar_images.length} size="small" color="success" />
            </Box>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {searchData.similar_images.slice(0, 3).map((image, index) => (
                <Card key={index} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                        {image.title}
                      </Typography>
                      <Chip label={image.source} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {image.description}
                    </Typography>
                    {image.url && (
                      <Link href={image.url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.8rem' }}>
                        View Source
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Related Information */}
        {searchData.related_information.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LinkIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Related Information
              </Typography>
              <Chip label={searchData.related_information.length} size="small" color="warning" />
            </Box>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {searchData.related_information.slice(0, 3).map((info, index) => (
                <Card key={index} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {info.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {info.snippet}
                    </Typography>
                    {info.url && (
                      <Link href={info.url} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.8rem' }}>
                        Read More
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        {/* Search Suggestions */}
        {searchData.suggestions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              💡 Search Suggestions
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {searchData.suggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  label={suggestion}
                  size="small"
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    // Could implement search functionality here
                    console.log('Search suggestion clicked:', suggestion)
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Search Metadata */}
        {searchData.search_metadata && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Search Metadata
            </Typography>
            {searchData.search_metadata.search_queries_used.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>Queries: </Typography>
                <Typography variant="caption" color="text.secondary">
                  {searchData.search_metadata.search_queries_used.join(', ')}
                </Typography>
              </Box>
            )}
            {searchData.search_metadata.grounding_sources.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>Sources: </Typography>
                <Typography variant="caption" color="text.secondary">
                  {searchData.search_metadata.grounding_sources.length} grounding sources
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}