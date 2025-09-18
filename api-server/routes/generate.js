const express = require("express");
const router = express.Router();

// Generate solution from problem info
router.post("/", async (req, res) => {
  try {
    const { textList, imageDataList, language = "cpp" } = req.body;
    const { callGeminiService, processImages } = req.app.locals;

    let combinedText = "";

    // Check if we have image data that needs OCR processing
    if (
      imageDataList &&
      Array.isArray(imageDataList) &&
      imageDataList.length > 0
    ) {
      console.log(`Received ${imageDataList.length} images for OCR processing`);
      try {
        console.log(`Attempting OCR on ${imageDataList.length} images...`);
        // Process images with OCR
        const extractedTexts = await processImages(imageDataList);

        if (!extractedTexts || extractedTexts.length === 0) {
          console.warn("No text extracted from images");

          // Try sending a description of the image content to Gemini
          console.log("Using image description approach with Gemini...");

          // Create a descriptive prompt about the code image
          combinedText =
            "The image contains a coding problem, likely from an interview or coding challenge. " +
            "The image might include a problem statement, examples, constraints, and possibly some starter code. " +
            "Based on this context, please provide a generic solution to a common coding problem " +
            "that demonstrates good coding practices, efficient algorithms, and proper error handling. " +
            "Since the specific problem couldn't be extracted, provide a solution to a medium-difficulty " +
            "problem that showcases your capabilities in data structures and algorithms.";

          console.log("Using descriptive prompt instead of OCR text");
        } else {
          combinedText = extractedTexts.join("\n\n");
          console.log(
            `OCR extraction successful: extracted ${extractedTexts.length} text segments`,
          );
          console.log(
            "Sample of extracted text:",
            combinedText.substring(0, 100) + "...",
          );

          // Log full extracted text for verification
          console.log("\n=== EXTRACTED TEXT FOR VERIFICATION START ===");
          extractedTexts.forEach((text, idx) => {
            console.log(`\n--- Image ${idx + 1} OCR Result ---`);
            console.log(text);
          });
          console.log("=== EXTRACTED TEXT FOR VERIFICATION END ===\n");
        }
      } catch (error) {
        console.error("OCR processing failed:", error);
        return res.status(500).json({
          error: "OCR processing failed",
          details: "Could not extract text from the provided images",
          technical: error.message,
          suggestion: "Please check server logs for more details",
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
        details: "Please provide either textList or imageDataList",
      });
    }

    // Validate the combined text
    if (!combinedText || combinedText.trim().length === 0) {
      return res.status(400).json({
        error: "No valid text extracted",
        details: "Could not extract any valid text from the inputs",
        suggestion: "Please provide clearer images or direct text input",
      });
    }

    // Log the combined text length for debugging
    console.log(`Processing combined text of length ${combinedText.length}`);

    console.log(`⚡ Generating real ${language} solution using Gemini AI`);
    console.log(`Input text starts with: ${combinedText.substring(0, 50)}...`);

    // Create a text preview with line breaks for better readability
    const textPreview = combinedText
      .split("\n")
      .map((line, i) => `Line ${i + 1}: ${line}`)
      .join("\n")
      .substring(0, 500);

    console.log("\n=== TEXT SENT TO GEMINI AI ===\n");
    console.log(textPreview);
    console.log("\n=== END OF TEXT PREVIEW ===\n");

    // Log OCR status for later analysis
    const usingOcr = !combinedText.includes(
      "The image contains a coding problem",
    );
    console.log(
      `Using OCR results: ${usingOcr ? "YES" : "NO (fallback mode)"}`,
    );

    let solution;
    try {
      solution = await callGeminiService(
        "generateSolution",
        { description: combinedText },
        language,
      );

      if (!solution) {
        throw new Error("Gemini returned empty solution");
      }

      console.log(" Real solution generation completed successfully");
    } catch (aiError) {
      console.error(" Gemini AI Error:", aiError.message);
      return res.status(500).json({
        error: "Gemini AI solution generation failed",
        details:
          "Could not generate solution. Gemini AI service is experiencing issues.",
        technical: aiError.message,
        suggestion:
          "Please try again later or check your Gemini API key configuration",
      });
    }

    res.json({
      code: solution.solution || solution.code || "",
      thoughts: Array.isArray(solution.explanation)
        ? solution.explanation
        : (solution.explanation || solution.thoughts || "")
            .split("\n")
            .filter((line) => line.trim()),
      time_complexity:
        solution.timeComplexity || solution.time_complexity || "",
      space_complexity:
        solution.spaceComplexity || solution.space_complexity || "",
      approach: solution.approach || "",
      language: solution.language || language,
      metadata: {
        language,
        service: "Gemini (Real AI)",
        mockDisabled: true,
        ocrEnabled: true,
        ocrSuccess: !combinedText.includes(
          "The image contains a coding problem",
        ),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Unexpected error in /api/generate:", error);
    res.status(500).json({
      error: "Unexpected server error",
      details: "An unexpected error occurred while generating the solution.",
      technical: error.message,
    });
  }
});

module.exports = router;
