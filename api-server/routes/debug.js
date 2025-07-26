const express = require('express');
const router = express.Router();

// Debug solution from additional screenshots
router.post("/", async (req, res) => {
  try {
    const { imageDataList, problemInfo, language = "cpp" } = req.body;
    const { ocrService, callGeminiService } = req.app.locals;

    // Validate input - require non-empty array and problem info
    if (
      !imageDataList ||
      !Array.isArray(imageDataList) ||
      imageDataList.length === 0
    ) {
      return res.status(400).json({
        error: "imageDataList is required and must be a non-empty array",
        details: "Please provide at least one debug screenshot in base64 format",
      });
    }

    if (!problemInfo || Object.keys(problemInfo).length === 0) {
      return res.status(400).json({
        error: "problemInfo is required",
        details: "Please provide the original problem information",
      });
    }

    console.log(
      `🐛 Processing ${imageDataList.length} debug screenshots for language: ${language}`
    );
    console.log(
      `🔧 Pipeline: Debug Screenshots → OCR → Text → Gemini → Improved Solution`
    );

    let debugInfo;
    let extractedText = "";

    try {
      // Step 1: Extract text using OCR from debug screenshots
      console.log("📝 Step 1: Extracting debug text using OCR...");
      extractedText = await ocrService.extractTextFromImages(imageDataList);

      // Validate OCR output
      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(422).json({
          error: "OCR failed to extract text from debug screenshots",
          details:
            "No text could be extracted from the provided debug screenshots. Please ensure the images contain readable text.",
          suggestion:
            "Try uploading higher quality debug screenshots with clear, readable text",
        });
      }

      console.log(`✅ OCR extracted ${extractedText.length} characters from debug screenshots`);
    } catch (ocrError) {
      console.error("❌ OCR Error:", ocrError.message);
      return res.status(422).json({
        error: "OCR processing failed",
        details:
          "Could not process the provided debug screenshots. Please check image format and content.",
        technical: ocrError.message,
        suggestion:
          "Ensure debug screenshots are in valid format (PNG, JPG) and contain readable text",
      });
    }

    try {
      // Step 2: Debug solution with Gemini AI
      console.log(
        "🤖 Step 2: Debugging solution with Gemini AI..."
      );
      debugInfo = await callGeminiService(
        "debugSolution",
        extractedText,
        problemInfo,
        language
      );

      // Validate AI output
      if (!debugInfo) {
        throw new Error("Gemini returned empty debug result");
      }

      console.log("✅ Debug solution generation completed successfully");
    } catch (aiError) {
      console.error("❌ Gemini AI Error:", aiError.message);
      return res.status(500).json({
        error: "Gemini AI debugging failed",
        details:
          "Could not debug the solution. Gemini AI service is experiencing issues.",
        technical: aiError.message,
        suggestion:
          "Please try again later or check your Gemini API key configuration",
      });
    }

    // Transform the response to match frontend expectations
    const response = {
      new_code: debugInfo.improvedSolution || debugInfo.solution || "",
      thoughts: Array.isArray(debugInfo.improvements) 
        ? debugInfo.improvements 
        : (debugInfo.improvements || debugInfo.thoughts || "").split('\n').filter(line => line.trim()),
      time_complexity: debugInfo.timeComplexity || debugInfo.time_complexity || "",
      space_complexity: debugInfo.spaceComplexity || debugInfo.space_complexity || "",
      debug_notes: debugInfo.debugNotes || "",
      language: debugInfo.language || language,
      metadata: {
        debugScreenshotsProcessed: imageDataList.length,
        textLength: extractedText.length,
        service: "Gemini (Real AI)",
        mockDisabled: true,
        timestamp: new Date().toISOString(),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("❌ Unexpected error in /api/debug:", error);
    res.status(500).json({
      error: "Unexpected server error",
      details: "An unexpected error occurred while debugging your solution.",
      technical: error.message,
    });
  }
});

module.exports = router; 