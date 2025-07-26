const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import only real AI services and OCR service
const GeminiService = require("./geminiService");
const OCRService = require("./ocrService");

// Import routes
const { healthRoutes, extractRoutes, generateRoutes, debugRoutes } = require("./routes");

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize only real services
const geminiService = new GeminiService();
const ocrService = new OCRService();

// Check if Gemini is available
const isGeminiAvailable = geminiService.isConfigured();

if (!isGeminiAvailable) {
  console.error("❌ CRITICAL: Gemini AI service is not configured!");
  console.error("   Please check your GEMINI_API_KEY in the .env file");
  process.exit(1);
}

console.log(`🎯 AI Service: Gemini (Real AI - No Mock)"`);
console.log(`📋 Pipeline: Screenshot → OCR → Text → Gemini → Real Response`);
console.log(`🚫 Mock AI removed for authentic problem analysis`);

// Function to use only Gemini service (no fallback to mock)
async function callGeminiService(method, ...args) {
  try {
    console.log(`🔄 Using Gemini service...`);
    const result = await geminiService[method](...args);
    console.log(`✅ Gemini service succeeded!`);
    return result;
  } catch (error) {
    console.log(`❌ Gemini service failed: ${error.message}`);
    throw new Error(`Gemini AI service failed: ${error.message}`);
  }
}

// Store services in app.locals for route access
app.locals.isGeminiAvailable = isGeminiAvailable;
app.locals.ocrService = ocrService;
app.locals.callGeminiService = callGeminiService;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/health", healthRoutes);
app.use("/api/extract", extractRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/debug", debugRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    details: `The endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: [
      "GET /health",
      "POST /api/extract",
      "POST /api/generate",
      "POST /api/debug",
    ],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("❌ Global error handler:", error);
  res.status(500).json({
    error: "Internal server error",
    details: "An unexpected error occurred",
    technical: error.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Interview Coder API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Extract endpoint: http://localhost:${PORT}/api/extract`);
  console.log(`⚡ Generate endpoint: http://localhost:${PORT}/api/generate`);
  console.log(`🐛 Debug endpoint: http://localhost:${PORT}/api/debug`);
  console.log(`🤖 AI Service: Gemini (Real AI Only)`);
  console.log(`🔍 OCR: Tesseract.js for text extraction`);
  console.log(`🚫 Mock AI: Disabled for authentic problem analysis`);
  console.log(`📋 Pipeline: Screenshot → OCR → Text → Gemini → Real Response`);
});

module.exports = app;
