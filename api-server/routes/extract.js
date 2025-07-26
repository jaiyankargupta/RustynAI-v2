const express = require('express');
const router = express.Router();

// Extract problem from screenshots
router.post("/", async (req, res) => {
  try {
    const { imageDataList, language = "cpp" } = req.body;
    const { ocrService, callGeminiService } = req.app.locals;

    // Validate input - require non-empty array
    if (
      !imageDataList ||
      !Array.isArray(imageDataList) ||
      imageDataList.length === 0
    ) {
      return res.status(400).json({
        error: "imageDataList is required and must be a non-empty array",
        details: "Please provide at least one image in base64 format",
      });
    }

    // Validate that image data is not empty
    const validImages = imageDataList.filter(
      (img) => img && img.trim().length > 0
    );
    if (validImages.length === 0) {
      return res.status(400).json({
        error: "No valid image data provided",
        details: "All images in the array are empty or invalid",
      });
    }

    console.log(
      `📸 Processing ${validImages.length} screenshots for language: ${language}`
    );
    console.log(
      `🔧 Pipeline: Screenshot → OCR → Text → Gemini → Real Response`
    );

    let problemInfo;
    let extractedText = "";

    try {
      // Step 1: Extract text using OCR
      console.log("📝 Step 1: Extracting text using OCR...");
      extractedText = await ocrService.extractTextFromImages(validImages);

      // Validate OCR output
      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          error: "OCR failed to extract text from images",
          details:
            "No text could be extracted from the provided screenshots. Please ensure the images contain readable text.",
          suggestion:
            "Try uploading higher quality images with clear, readable text",
        });
      }

      console.log(`✅ OCR extracted ${extractedText.length} characters`);
    } catch (ocrError) {
      console.error("❌ OCR Error:", ocrError.message);
      return res.status(422).json({
        error: "OCR processing failed",
        details:
          "Could not process the provided images. Please check image format and content.",
        technical: ocrError.message,
        suggestion:
          "Ensure images are in valid format (PNG, JPG) and contain readable text",
      });
    }

    try {
      // Step 2: Analyze text with Gemini AI (no mock fallback)
      console.log(
        "🤖 Step 2: Analyzing text with Gemini AI (Real Analysis)..."
      );
      problemInfo = await callGeminiService(
        "extractProblem",
        extractedText,
        language
      );

      // Validate AI output
      if (!problemInfo) {
        throw new Error("Gemini returned empty result");
      }

      console.log("✅ Real problem extraction completed successfully");
    } catch (aiError) {
      console.error("❌ Gemini AI Error:", aiError.message);
      return res.status(500).json({
        error: "Gemini AI analysis failed",
        details:
          "Could not analyze the extracted text. Gemini AI service is experiencing issues.",
        technical: aiError.message,
        suggestion:
          "Please try again later or check your Gemini API key configuration",
      });
    }

    res.json({
      ...problemInfo,
      extractedText: extractedText.substring(0, 500) + "...", // Include preview of extracted text
      metadata: {
        imagesProcessed: validImages.length,
        textLength: extractedText.length,
        service: "Gemini (Real AI)",
        mockDisabled: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Unexpected error in /api/extract:", error);
    res.status(500).json({
      error: "Unexpected server error",
      details: "An unexpected error occurred while processing your request.",
      technical: error.message,
    });
  }
});

module.exports = router; 