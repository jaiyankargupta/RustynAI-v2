# Interview Coder API Server

A Node.js/Express API server that provides endpoints for processing coding interview screenshots and generating solutions.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Navigate to the api-server directory:

```bash
cd api-server
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Edit `.env` file with your configuration (optional for mock testing)

5. Start the server:

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## 📡 API Endpoints

### Health Check

```
GET /health
```

Returns server status and uptime.

### Extract Problem

```
POST /api/extract
```

Extracts problem statement from screenshot images.

**Request Body:**

```json
{
  "imageDataList": ["base64_image_1", "base64_image_2"],
  "language": "cpp"
}
```

**Response:**

```json
{
  "title": "Two Sum",
  "description": "Problem description...",
  "examples": [...],
  "constraints": [...],
  "difficulty": "Easy",
  "topics": ["Array", "Hash Table"],
  "language": "cpp"
}
```

### Generate Solution

```
POST /api/generate
```

Generates solution code from problem information.

**Request Body:**

```json
{
  "title": "Two Sum",
  "description": "Problem description...",
  "language": "cpp"
}
```

**Response:**

```json
{
  "solution": "class Solution { ... }",
  "explanation": "Detailed explanation...",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(n)",
  "approach": "Hash Table",
  "language": "cpp"
}
```

### Debug Solution

```
POST /api/debug
```

Improves existing solution with additional context.

**Request Body:**

```json
{
  "imageDataList": ["base64_image_1", "base64_image_2"],
  "problemInfo": { "title": "...", "description": "..." },
  "language": "cpp"
}
```

**Response:**

```json
{
  "improvedSolution": "class Solution { ... }",
  "improvements": ["Added error handling", "Better variable names"],
  "debugNotes": "Explanation of improvements",
  "language": "cpp"
}
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)
- `OPENAI_API_KEY`: OpenAI API key for real AI processing
- `ANTHROPIC_API_KEY`: Anthropic API key for real AI processing

### Supported Languages

- `cpp` (C++)
- `python` (Python)
- `java` (Java)
- `javascript` (JavaScript)

## 🔄 Integration with Electron App

The Electron app's `ProcessingHelper.ts` expects these endpoints:

```typescript
// Extract problem from screenshots
POST ${API_BASE_URL}/api/extract

// Generate solution from problem
POST ${API_BASE_URL}/api/generate

// Debug/improve solution
POST ${API_BASE_URL}/api/debug
```

The `API_BASE_URL` in the Electron app is set to:

- Development: `http://localhost:3001`
- Production: `https://www.rustynai.com`

## 🤖 Adding Real AI Integration

Currently, the server uses mock responses. To integrate with real AI services:

1. **OpenAI Integration:**

```javascript
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Replace mockExtractProblem with:
const extractProblemWithAI = async (imageDataList, language) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the coding problem from these screenshots...",
          },
          ...imageDataList.map((img) => ({
            type: "image_url",
            image_url: { url: `data:image/png;base64,${img}` },
          })),
        ],
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
};
```

2. **Anthropic Integration:**

```javascript
const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Similar integration for Claude
```

## 🧪 Testing

Test the endpoints with curl:

```bash
# Health check
curl http://localhost:3001/health

# Extract problem (with mock data)
curl -X POST http://localhost:3001/api/extract \
  -H "Content-Type: application/json" \
  -d '{"imageDataList":["test"], "language":"cpp"}'
```

## 📝 Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid input)
- `500`: Internal Server Error

## 🔍 Monitoring

The server logs all requests with timestamps:

```
2024-01-01T12:00:00.000Z - POST /api/extract
```

For production, consider adding:

- Rate limiting
- Request logging to files
- Error monitoring (Sentry, etc.)
- Health metrics (Prometheus, etc.)
