const axios = require("axios");

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

    if (!this.apiKey) {
      console.log("Gemini API key not found.");
    } else {
      console.log("Gemini service initialized...");
    }
  }

  async makeRequest(prompt, operation = "process") {
    try {
      console.log(`🔍 ${operation} using Gemini 1.5 Flash...`);

      const requestData = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 3000,
        },
      };

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 300000,
        }
      );

      if (!response.data.candidates || !response.data.candidates[0]) {
        throw new Error("Invalid response from Gemini API");
      }

      const content = response.data.candidates[0].content.parts[0].text;
      console.log(`✅ ${operation} successful with Gemini`);
      return content;
    } catch (error) {
      console.log(`Gemini failed: ${error.message}`);
      throw error;
    }
  }

  async extractProblem(extractedText, language = "cpp") {
    if (!this.apiKey) {
      throw new Error(
        "Gemini API key not provided. Please set GEMINI_API_KEY."
      );
    }

    const prompt = `You are an expert at analyzing coding interview problems. Given extracted text from problem screenshots, parse and structure the complete problem statement and return it as valid JSON.

Required JSON format:
{
  "title": "Problem Title",
  "description": "Complete problem description",
  "examples": [
    {
      "input": "Example input",
      "output": "Expected output", 
      "explanation": "Why this output"
    }
  ],
  "constraints": ["List of constraints"],
  "difficulty": "Easy/Medium/Hard",
  "topics": ["Array", "Hash Table", etc.],
  "language": "${language}"
}

Please analyze this extracted text from coding problem screenshots and structure it into the required JSON format:

--- EXTRACTED TEXT ---
${extractedText}
--- END EXTRACTED TEXT ---

Parse this text and return a well-structured JSON representation of the coding problem for ${language} language.`;

    try {
      const content_text = await this.makeRequest(prompt, "Problem Analysis");

      // Try to parse JSON response
      try {
        return JSON.parse(content_text);
      } catch (parseError) {
        console.log(
          "Failed to parse problem extraction JSON, attempting to clean..."
        );

        // Remove code block markers if present
        let cleanedText = content_text
          .replace(/```json\s*/g, "")
          .replace(/```\s*$/g, "");

        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            // Fix common JSON issues
            let fixedJson = jsonMatch[0];
            fixedJson = fixedJson.replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

            try {
              return JSON.parse(fixedJson);
            } catch (thirdParseError) {
              // Return basic structure if parsing fails
              return {
                title: "Problem Title (Parse Error)",
                description: "Could not parse problem from AI response",
                examples: [],
                constraints: [],
                difficulty: "Unknown",
                topics: [],
                language: language,
              };
            }
          }
        }

        // Return fallback structure
        return {
          title: "Problem Title (No JSON Found)",
          description: "No valid JSON found in AI response",
          examples: [],
          constraints: [],
          difficulty: "Unknown",
          topics: [],
          language: language,
        };
      }
    } catch (error) {
      console.error("Error in Gemini problem extraction:", error);
      throw new Error(`Failed to extract problem: ${error.message}`);
    }
  }

  async generateSolution(problemInfo, language = "cpp") {
    if (!this.apiKey) {
      throw new Error(
        "Gemini API key not provided. Please set GEMINI_API_KEY."
      );
    }

    const prompt = `You are an expert competitive programmer. Generate an optimal solution for the given coding problem.

Requirements:
1. Write clean, efficient, well-commented code in ${language}
2. Use the most optimal algorithm and data structures
3. Follow the exact function signature if provided in the problem
4. Include proper error handling where appropriate
5. Return response as valid JSON

Required JSON format:
{
  "solution": "Complete working code solution",
  "explanation": "Step-by-step explanation of the approach",
  "timeComplexity": "O(n) notation",
  "spaceComplexity": "O(n) notation", 
  "approach": "Brief description of algorithm used",
  "language": "${language}"
}

Problem: ${problemInfo.title}

Description: ${problemInfo.description}

Examples: ${JSON.stringify(problemInfo.examples || [])}

Constraints: ${JSON.stringify(problemInfo.constraints || [])}

Generate an optimal ${language} solution for this problem. Focus on correctness, efficiency, and clean code.`;

    try {
      const content_text = await this.makeRequest(
        prompt,
        "Solution Generation"
      );

      try {
        return JSON.parse(content_text);
      } catch (parseError) {
        console.log("Failed to parse JSON, attempting to clean response...");
        console.log(
          "Raw response preview:",
          content_text.substring(0, 200) + "..."
        );

        // Try to extract JSON from code blocks or clean the response
        let cleanedText = content_text;

        // Remove code block markers if present
        cleanedText = cleanedText
          .replace(/```json\s*/g, "")
          .replace(/```\s*$/g, "");

        // Try to find JSON object
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            console.log(
              "Second JSON parse failed, trying to fix common issues..."
            );

            // Fix common JSON issues
            let fixedJson = jsonMatch[0];

            // Fix trailing commas
            fixedJson = fixedJson.replace(/,(\s*[}\]])/g, "$1");

            // Fix unescaped quotes in strings
            fixedJson = fixedJson.replace(
              /:\s*"([^"]*)"([^",}\]]*)"([^",}\]]*)"/,
              ':"$1\\"$2\\"$3"'
            );

            try {
              return JSON.parse(fixedJson);
            } catch (thirdParseError) {
              console.log("All JSON parsing attempts failed");
              // Return a basic structure if all parsing fails
              return {
                solution:
                  "// Error: Could not parse AI response\n// Please try again",
                explanation:
                  "The AI response could not be parsed properly. Please try generating the solution again.",
                timeComplexity: "Unknown",
                spaceComplexity: "Unknown",
                approach: "Error in parsing",
              };
            }
          }
        }

        // If no JSON found, return error structure
        return {
          solution:
            "// Error: No valid JSON found in response\n// Please try again",
          explanation:
            "No valid JSON structure found in the AI response. Please try again.",
          timeComplexity: "Unknown",
          spaceComplexity: "Unknown",
          approach: "Error in response",
        };
      }
    } catch (error) {
      console.error("Error in Gemini solution generation:", error);
      throw new Error(`Failed to generate solution: ${error.message}`);
    }
  }

  async debugSolution(extractedText, problemInfo, language = "cpp") {
    if (!this.apiKey) {
      throw new Error(
        "Gemini API key not provided. Please set GEMINI_API_KEY."
      );
    }

    const prompt = `You are an expert code reviewer and debugging specialist. Analyze the extracted text from debugging screenshots and improve the existing solution.

Look for:
1. Error messages or failed test cases in the text
2. Performance issues or edge cases mentioned
3. Code style improvements needed
4. Better algorithms or optimizations
5. Bug fixes required

Return response as valid JSON:
{
  "improvedSolution": "Enhanced code solution",
  "improvements": ["List of specific improvements made"],
  "debugNotes": "Explanation of what was identified and fixed",
  "language": "${language}"
}

Original Problem: ${problemInfo.title}

Description: ${problemInfo.description}

Debug Information from Screenshots:
--- EXTRACTED DEBUG TEXT ---
${extractedText}
--- END DEBUG TEXT ---

Please analyze the extracted debug text for error messages, failed test cases, or debugging information. Then provide an improved solution that addresses any issues found.

Focus on:
- Fixing any errors mentioned in the debug text
- Optimizing performance if needed
- Improving code clarity and robustness
- Handling edge cases better`;

    try {
      const content_text = await this.makeRequest(prompt, "Solution Debugging");

      try {
        return JSON.parse(content_text);
      } catch (parseError) {
        const jsonMatch = content_text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Could not parse AI response as JSON");
      }
    } catch (error) {
      console.error("Error in Gemini solution debugging:", error);
      throw new Error(`Failed to debug solution: ${error.message}`);
    }
  }

  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = GeminiService;
