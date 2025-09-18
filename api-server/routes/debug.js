const express = require("express");
const router = express.Router();

// Generate solution from problem info
router.post("/", async (req, res) => {
  // Process image data or use provided text list
  const { textList, imageDataList, problemInfo } = req.body;
  const language = req.body.language || "cpp";
  const { callGeminiService, processImages } = req.app.locals;
  console.log("🔧 Pipeline: Debug Text → Gemini → Improved Solution");

  let combinedText = "";

  // Check if we have image data that needs OCR processing
  if (
    imageDataList &&
    Array.isArray(imageDataList) &&
    imageDataList.length > 0
  ) {
    console.log(
      `Received ${imageDataList.length} debug images for OCR processing`,
    );
    try {
      console.log(`Attempting OCR on ${imageDataList.length} debug images...`);
      // Process images with OCR
      const extractedTexts = await processImages(imageDataList);

      if (!extractedTexts || extractedTexts.length === 0) {
        console.warn("No text extracted from debug images");

        // Fall back to direct image data if OCR fails completely
        console.log(
          "Attempting to use image data directly with Gemini for debugging...",
        );

        // Use placeholder text to indicate this is image data
        combinedText =
          "DEBUG IMAGE DATA: Unable to extract text via OCR. Processing debug image directly.";
      } else {
        combinedText = extractedTexts.join("\n\n");
        console.log(
          `Debug OCR extraction successful: extracted ${extractedTexts.length} text segments`,
        );
        console.log(
          "Sample of extracted debug text:",
          combinedText.substring(0, 100) + "...",
        );
      }
    } catch (error) {
      console.error("Debug OCR processing failed:", error);
      return res.status(500).json({
        error: "OCR processing failed",
        details: "Could not extract text from the provided debug images",
        technical: error.message,
        suggestion: "Please provide clearer debug screenshots",
      });
    }
  }
  // If we also have direct text input or no OCR results, use that
  else if (textList && Array.isArray(textList) && textList.length > 0) {
    combinedText = textList
      .filter((t) => t && t.trim().length > 0)
      .join("\n\n");
  } else {
    return res.status(400).json({
      error: "No valid input provided",
      details: "Please provide either textList or imageDataList for debugging",
    });
  }
  if (!combinedText || combinedText.trim().length === 0) {
    return res.status(400).json({
      error: "No valid text provided",
      details: "All texts in the array are empty or invalid",
      suggestion: "Please provide clearer screenshots for OCR processing",
    });
  }

  // Log the combined text length for debugging
  console.log(`Processing debug text of length ${combinedText.length}`);
  console.log(
    `Debug input text starts with: ${combinedText.substring(0, 50)}...`,
  );
  let debugInfo;
  try {
    // Analyze text with Gemini AI
    console.log("🤖 Analyzing debug text with Gemini AI...");
    debugInfo = await callGeminiService(
      "debugSolution",
      combinedText,
      problemInfo,
      language,
    );
    if (!debugInfo) {
      throw new Error("Gemini returned empty result");
    }
    console.log("✅ Real debug analysis completed successfully");
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
    ...debugInfo,
  });
});

module.exports = router;
