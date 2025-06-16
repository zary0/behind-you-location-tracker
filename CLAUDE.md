# ReverseGeo - Location Tracker

AI-powered reverse geolocation service that identifies locations from single images using Gemini Live API and Google Maps integration.

## Project Overview

This is a Next.js 15 application that uses AI to analyze images and identify geographic locations. It features real-time camera capture, multiple AI analysis modes, and interactive Google Maps integration with location history tracking.

## Repository Information

- **GitHub Repository**: `behind-you-location-tracker`
- **GitHub Username**: `zary0`
- **Platform**: Cloudflare Workers deployment

## Technology Stack

- **Frontend**: Next.js 15 + TypeScript + React 19
- **UI Components**: Material-UI (MUI) + Tailwind CSS + shadcn/ui
- **AI/ML**: Google Gemini 2.0 Flash Exp API (multiple modes)
- **Maps**: Google Maps JavaScript API + 3D Maps
- **Database**: DuckDB WASM for client-side location history
- **Deployment**: Cloudflare Workers + @opennextjs/cloudflare
- **Build Tool**: Wrangler

## Available Scripts

```bash
# Development
npm run dev              # Start development server on localhost:3000

# Production Build & Deploy
npm run build           # Build for production
npm run start          # Start production server locally
npm run deploy         # Build and deploy to Cloudflare Workers

# Code Quality
npm run lint           # Run ESLint
npm test              # No tests configured yet
```

## Project Structure

```
src/
├── app/
│   ├── api/                           # API routes
│   │   ├── analyze-location/          # Basic Gemini analysis
│   │   ├── analyze-location-with-search/  # Function calling mode
│   │   ├── analyze-location-grounded/ # Google Search grounding
│   │   └── image-search/             # Image similarity search
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout with MUI theme
│   └── page.tsx                      # Main application page
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── CameraCapture.tsx            # Camera and image upload
│   ├── LocationMap.tsx              # Google Maps integration
│   ├── LocationHistorySidebar.tsx   # History management
│   ├── ImageSearchResults.tsx       # Image search display
│   ├── MuiThemeProvider.tsx         # MUI theme configuration
│   └── theme-provider.tsx           # Theme switching
└── lib/
    ├── gemini-auth.ts               # Gemini API client functions
    ├── google-maps-loader.ts        # Maps API loader
    ├── location-history-db.ts       # DuckDB WASM database
    └── utils.ts                     # Utility functions
```

## Configuration Files

### Environment Variables Required

Create `.env.local` from `.env.local.example`:

```bash
# Google APIs
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional
NODE_ENV=development
```

### Key Configuration Files

- **next.config.ts**: Security headers, CORS, serverExternalPackages
- **wrangler.jsonc**: Cloudflare Workers deployment configuration
- **open-next.config.ts**: OpenNext Cloudflare adapter settings
- **tailwind.config.ts**: Tailwind CSS configuration
- **components.json**: shadcn/ui configuration (New York style)

## Core Features

### 1. Multi-Modal AI Analysis
- **Basic Analysis**: Standard Gemini vision analysis
- **Function Calling**: Enhanced analysis with function calling
- **Google Search Grounding**: Web-enhanced location detection
- **Image Search**: Visual similarity search for landmarks

### 2. Real-time Camera Integration
- WebRTC camera access
- Real-time frame capture
- Image upload from device
- Camera toggle visibility

### 3. Interactive Mapping
- Google Maps 2D/3D integration
- Location markers with descriptions
- Zoom to detected locations
- Location history visualization

### 4. Data Persistence
- Client-side DuckDB WASM database
- Location history tracking
- Analysis metadata storage
- Confidence scoring

## API Endpoints

### POST /api/analyze-location
Basic Gemini vision analysis for location detection.

**Request:**
```json
{
  "image": "base64_encoded_image_data"
}
```

**Response:**
```json
{
  "latitude": 35.6762,
  "longitude": 139.6503,
  "description": "Tokyo Station, Japan",
  "confidence": 0.85,
  "landmarks": ["Tokyo Station", "Imperial Palace"]
}
```

### POST /api/analyze-location-with-search
Enhanced analysis using function calling capabilities.

### POST /api/analyze-location-grounded
Analysis with Google Search grounding for improved accuracy.

### POST /api/image-search
Visual similarity search for location identification.

## Security Considerations

### Headers (next.config.ts)
- Cross-Origin-Embedder-Policy: require-corp
- Cross-Origin-Opener-Policy: same-origin
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- X-XSS-Protection: 1; mode=block

### Input Validation
- Maximum image size: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp
- Base64 format validation
- Request size limits

### Rate Limiting
⚠️ **Production TODO**: Implement proper rate limiting for API endpoints

## Deployment

### Cloudflare Workers Setup

1. **Build Configuration**:
   ```bash
   npm run build  # Creates .open-next/ directory
   ```

2. **Deploy Command**:
   ```bash
   npm run deploy  # Runs build + wrangler deploy
   ```

3. **Wrangler Configuration** (wrangler.jsonc):
   - Node.js compatibility enabled
   - Assets binding for static files
   - Production environment variables

### Environment Variables (Production)
Set in Cloudflare Workers dashboard:
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `ENVIRONMENT=production`

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint configuration with Next.js rules
- Tailwind CSS for styling
- Material-UI for complex components

### Component Architecture
- React Server Components where possible
- Client components for interactivity
- Proper error boundaries
- Loading states and fallbacks

### State Management
- React hooks for local state
- No global state management (Redux/Zustand) currently
- Client-side database for persistence

## Performance Optimizations

- Next.js Image component for optimized images
- Dynamic imports for heavy components
- Server-side rendering where applicable
- Efficient re-renders with proper memoization

## Browser Compatibility

- Modern browsers with WebRTC support
- Camera API requirements
- WebAssembly support for DuckDB
- ES2020+ JavaScript features

## Known Limitations

1. **Camera Access**: Requires HTTPS in production
2. **API Costs**: Gemini API usage costs apply
3. **Client Storage**: DuckDB data stored locally only
4. **Rate Limits**: No built-in API rate limiting
5. **Offline Support**: Limited offline functionality

## Future Enhancements

- [ ] User authentication system
- [ ] Cloud database integration
- [ ] API rate limiting
- [ ] Batch image processing
- [ ] Location accuracy improvements
- [ ] Mobile app version
- [ ] Advanced search filters

## Troubleshooting

### Common Issues

1. **Camera not working**: Check HTTPS requirement and permissions
2. **API key errors**: Verify environment variables are set
3. **Maps not loading**: Check Google Maps API key and billing
4. **Build failures**: Ensure all dependencies are installed

### Debug Mode
Set `NODE_ENV=development` for detailed console logging.

## License

MIT License - See project for full license details.