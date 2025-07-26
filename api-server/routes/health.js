const express = require('express');
const router = express.Router();

// Health check endpoint
router.get("/", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      gemini: req.app.locals.isGeminiAvailable,
      ocr: true,
      mockAI: false, // Explicitly disabled
    },
    pipeline: "Screenshot → OCR → Text → Gemini → Real Response",
  });
});

module.exports = router; 