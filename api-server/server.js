const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import AI services and OCR service
const GeminiService = require("./geminiService");
const OCRService = require("./ocrService");

// Import routes
const { healthRoutes, generateRoutes, debugRoutes } = require("./routes");

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const geminiService = new GeminiService();
const ocrService = new OCRService();

// Check if Gemini is available
const isGeminiAvailable = geminiService.isConfigured();
if (!isGeminiAvailable) {
  console.error("❌ CRITICAL: Gemini AI service is not configured!");
  console.error("   Please check your GEMINI_API_KEY in the .env file");
  process.exit(1);
}

console.log(`🎯 AI Service: Gemini (Real AI - No Mock)`);
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

// Function to process image data with OCR
async function processImages(imageDataList) {
  try {
    console.log(`🔄 Processing ${imageDataList.length} images with OCR...`);

    // Validate image data format
    for (let i = 0; i < imageDataList.length; i++) {
      const img = imageDataList[i];
      if (!img || typeof img !== "string") {
        console.error(`Invalid image data at index ${i}`);
        continue;
      }

      // Check if image data has correct prefix
      if (!img.startsWith("data:image/")) {
        console.log(
          `Image ${i + 1} doesn't have proper data URL format, attempting to fix...`,
        );
        imageDataList[i] = `data:image/png;base64,${img}`;
      }

      // Log a small sample of each image to verify it's received correctly
      const sampleStart = imageDataList[i].substring(0, 50);
      const sampleEnd = imageDataList[i].substring(
        imageDataList[i].length - 20,
      );
      console.log(`Image ${i + 1}: ${sampleStart}...${sampleEnd}`);
    }

    console.log("Starting OCR batch processing...");
    const textList = await ocrService.processImageBatch(imageDataList);

    // Log OCR results
    if (textList && textList.length > 0) {
      console.log(
        `✅ OCR processing completed with ${textList.length} valid text extractions`,
      );
      const totalChars = textList.reduce((sum, text) => sum + text.length, 0);
      console.log(`Total extracted text: ${totalChars} characters`);
      console.log(
        `Average characters per image: ${Math.round(totalChars / textList.length)}`,
      );

      // Log a sample of each extracted text
      textList.forEach((text, idx) => {
        const preview = text.substring(0, 100).replace(/\n/g, "\\n");
        console.log(
          `Text ${idx + 1} (${text.length} chars): ${preview}${text.length > 100 ? "..." : ""}`,
        );
      });

      return textList;
    } else {
      console.log("⚠️ No valid text extracted from images");
      return [];
    }
  } catch (error) {
    console.log(`❌ OCR processing failed: ${error.message}`);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

// Store services in app.locals for route access
app.locals.isGeminiAvailable = isGeminiAvailable;
app.locals.callGeminiService = callGeminiService;
app.locals.processImages = processImages;

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
// Removed /api/extract route
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
  console.error("Global error handler:", error);
  res.status(500).json({
    error: "Internal server error",
    details: "An unexpected error occurred",
    technical: error.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
