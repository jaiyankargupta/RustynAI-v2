const express = require('express');
const router = express.Router();

// Generate solution from problem info
router.post("/", async (req, res) => {
  try {
    const { language = "cpp", ...problemInfo } = req.body;
    const { callGeminiService } = req.app.locals;

    // Validate input
    if (!problemInfo || Object.keys(problemInfo).length === 0) {
      return res.status(400).json({
        error: "Problem information is required",
        details: "Please provide problem details extracted from screenshots",
      });
    }

    console.log(`⚡ Generating real ${language} solution using Gemini AI`);

    let solution;
    try {
      solution = await callGeminiService(
        "generateSolution",
        problemInfo,
        language
      );

      if (!solution) {
        throw new Error("Gemini returned empty solution");
      }

      console.log("✅ Real solution generation completed successfully");
    } catch (aiError) {
      console.error("❌ Gemini AI Error:", aiError.message);
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
      // Transform to match frontend expectations
      code: solution.solution || solution.code || "",
      thoughts: Array.isArray(solution.explanation) 
        ? solution.explanation 
        : (solution.explanation || solution.thoughts || "").split('\n').filter(line => line.trim()),
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
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Unexpected error in /api/generate:", error);
    res.status(500).json({
      error: "Unexpected server error",
      details: "An unexpected error occurred while generating the solution.",
      technical: error.message,
    });
  }
});

module.exports = router; 