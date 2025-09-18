const axios = require("axios");

class GeminiService {
  constructor() {
    // Load multiple API keys from environment variables
    this.apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY1,
      process.env.GEMINI_API_KEY2,
      process.env.GEMINI_API_KEY3,
      process.env.GEMINI_API_KEY4,
      process.env.GEMINI_API_KEY5,
    ].filter((key) => key && key.trim() !== ""); // Remove empty keys

    this.currentKeyIndex = 0;
    this.apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

    if (this.apiKeys.length === 0) {
      console.log(
        "No Gemini API keys found. Please set GEMINI_API_KEY, GEMINI_API_KEY1, GEMINI_API_KEY2, etc."
      );
    } else {
      console.log(
        `✅ Gemini service initialized with ${this.apiKeys.length} API key(s)`
      );
    }
  }

  async makeRequest(prompt, operation = "process") {
    if (this.apiKeys.length === 0) {
      throw new Error("No Gemini API keys available");
    }

    let lastError;

    // Try each API key until one works
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const currentKey = this.apiKeys[this.currentKeyIndex];

      try {
        console.log(
          `🔍 ${operation} using Gemini 1.5 Flash (Key ${
            this.currentKeyIndex + 1
          }/${this.apiKeys.length})...`
        );

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
            temperature: 0.2,
            maxOutputTokens: 4000,
            topP: 0.8,
            topK: 40,
            candidateCount: 1,
            stopSequences: [],
          },
        };

        const response = await axios.post(
          `${this.apiUrl}?key=${currentKey}`,
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
        console.log(
          `✅ ${operation} successful with Gemini (Key ${
            this.currentKeyIndex + 1
          })`
        );
        return content;
      } catch (error) {
        lastError = error;
        console.log(
          `❌ Key ${this.currentKeyIndex + 1} failed: ${error.message}`
        );

        // Move to next API key
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

        // If it's a quota/rate limit error, try next key immediately
        if (
          error.response?.status === 429 ||
          error.message.includes("quota") ||
          error.message.includes("rate limit") ||
          error.response?.status === 403
        ) {
          console.log(
            `🔄 Switching to next API key due to rate limit/quota...`
          );
          continue;
        }

        // For other errors, still try next key but log differently
        console.log(`🔄 Trying next API key...`);
      }
    }

    // If all keys failed, throw the last error
    console.log(`❌ All ${this.apiKeys.length} Gemini API keys failed`);
    throw new Error(
      `All Gemini API keys failed. Last error: ${lastError?.message}`
    );
  }

  // Helper method to detect programming language from text
  detectLanguageFromText(text) {
    const textLower = text.toLowerCase();

    // Language detection patterns (order matters - more specific first)
    const languagePatterns = [
      {
        lang: "java",
        patterns: [
          "java",
          "public class",
          "public static void main",
          "system.out.print",
        ],
      },
      {
        lang: "python",
        patterns: [
          "python",
          "def ",
          "print(",
          "if __name__",
          "import ",
          "from ",
        ],
      },
      {
        lang: "javascript",
        patterns: [
          "javascript",
          "js",
          "console.log",
          "function ",
          "const ",
          "let ",
        ],
      },
      {
        lang: "csharp",
        patterns: [
          "c#",
          "csharp",
          "console.writeline",
          "using system",
          "public static void",
        ],
      },
      {
        lang: "go",
        patterns: [
          "golang",
          "go lang",
          "func main",
          "package main",
          "fmt.print",
        ],
      },
      { lang: "rust", patterns: ["rust", "fn main", "println!", "cargo"] },
      { lang: "kotlin", patterns: ["kotlin", "fun main"] },
      { lang: "swift", patterns: ["swift", "import foundation"] },
      {
        lang: "cpp",
        patterns: [
          "c++",
          "cpp",
          "#include <iostream>",
          "std::",
          "cout <<",
          "cin >>",
          "int main()",
        ],
      },
    ];

    // Check for explicit language mentions first
    for (const { lang, patterns } of languagePatterns) {
      for (const pattern of patterns) {
        if (textLower.includes(pattern)) {
          console.log(
            `🔍 Detected language: ${lang} (found pattern: "${pattern}")`
          );
          return lang;
        }
      }
    }

    // Default to C++ if no language detected
    console.log("🔍 No specific language detected, defaulting to cpp");
    return "cpp";
  }

  async extractProblem(extractedText, language = null) {
    if (this.apiKeys.length === 0) {
      throw new Error(
        "No Gemini API keys available. Please set GEMINI_API_KEY, GEMINI_API_KEY1, GEMINI_API_KEY2, etc."
      );
    }

    // Auto-detect language from extracted text if not provided
    const detectedLanguage =
      language || this.detectLanguageFromText(extractedText);
    console.log(
      `📝 Using language: ${detectedLanguage} for problem extraction`
    );

    const prompt = `You are an expert software engineer specializing in competitive programming and coding interviews. Your task is to analyze extracted text from problem screenshots and convert it into a perfectly structured JSON format.

LANGUAGE DETECTION: The target programming language has been detected as "${detectedLanguage}". Pay special attention to language-specific syntax, conventions, and requirements mentioned in the problem.

CRITICAL INSTRUCTIONS:
1. Extract ALL information accurately - don't miss any details
2. Infer missing information intelligently based on context
3. Clean up OCR errors and formatting issues
4. Categorize difficulty based on problem complexity
5. Identify relevant data structures and algorithms needed
6. DETECT programming language hints from the text (function signatures, syntax examples, imports)
7. ALWAYS return valid JSON - no extra text or explanations

REQUIRED JSON FORMAT (return ONLY this JSON, no other text):
{
  "title": "Exact problem title or create descriptive one",
  "description": "Complete, clean problem description with all requirements",
  "examples": [
    {
      "input": "Exact input format with proper formatting",
      "output": "Expected output with proper formatting",
      "explanation": "Clear explanation of why this input produces this output"
    }
  ],
  "constraints": ["All numerical constraints", "Input/output limits", "Edge case conditions"],
  "difficulty": "Easy/Medium/Hard",
  "topics": ["Relevant algorithms/data structures like Array, Hash Table, Dynamic Programming, etc."],
  "language": "${detectedLanguage}",
  "hints": ["Strategic hints for solving", "Key insights", "Common pitfalls to avoid"],
  "functionSignature": "Extract exact function signature if provided, or create appropriate one for ${detectedLanguage}"
}

LANGUAGE-SPECIFIC ANALYSIS:
${
  detectedLanguage === "java"
    ? "- Look for class definitions, method signatures, and Java-specific syntax"
    : detectedLanguage === "python"
    ? "- Look for function definitions with def, Python-specific syntax and indentation"
    : detectedLanguage === "javascript"
    ? "- Look for function declarations, ES6+ syntax, and JavaScript conventions"
    : detectedLanguage === "csharp"
    ? "- Look for class definitions, method signatures, and C# syntax"
    : detectedLanguage === "cpp"
    ? "- Look for function declarations, STL usage, and C++ specific syntax"
    : "- Look for language-specific syntax and conventions"
}
- Pay attention to data type specifications and method signatures
- Note any imports, includes, or using statements that indicate language
- Identify language-specific data structures and libraries mentioned

ANALYSIS GUIDELINES:
- For difficulty: Easy (basic loops/conditions), Medium (multiple concepts/optimizations), Hard (advanced algorithms/complex logic)
- Extract exact input/output formats, including data types
- Identify all constraints including time/space complexity requirements
- Clean up OCR artifacts like "1ot" → "lot", "0" → "O", etc.
- If examples are malformed, reconstruct them logically
- Infer problem category from description (e.g., two pointers, sliding window, BFS/DFS)

EXTRACTED TEXT FROM SCREENSHOT:
--- START EXTRACTION ---
${extractedText}
--- END EXTRACTION ---

Analyze and return the structured JSON for this ${detectedLanguage} coding problem:`;

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
                language: detectedLanguage,
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
          language: detectedLanguage,
        };
      }
    } catch (error) {
      console.error("Error in Gemini problem extraction:", error);
      throw new Error(`Failed to extract problem: ${error.message}`);
    }
  }

  async generateSolution(problemInfo, language = null) {
    if (this.apiKeys.length === 0) {
      throw new Error(
        "No Gemini API keys available. Please set GEMINI_API_KEY, GEMINI_API_KEY_2, etc."
      );
    }

    // Use language from problemInfo if available, otherwise use provided language or default to cpp
    const targetLanguage = problemInfo.language || language || "cpp";
    console.log(`💻 Generating solution in: ${targetLanguage}`);

    const prompt = `You are a world-class competitive programmer and software engineer. Generate the most optimal, production-ready solution for this coding problem.

SOLUTION REQUIREMENTS:
1. CORRECTNESS: Handle all edge cases and constraints
2. EFFICIENCY: Use the most optimal algorithm and data structures
3. READABILITY: Clean, well-commented, interview-ready code
4. COMPLETENESS: Include all necessary imports and helper functions
5. ROBUSTNESS: Handle edge cases gracefully

CODING STANDARDS FOR ${targetLanguage.toUpperCase()}:
${
  targetLanguage === "cpp"
    ? `- Use standard library efficiently (STL containers, algorithms)
- Prefer const references for large objects
- Use auto for type deduction where appropriate
- Follow proper memory management
- Use meaningful variable names`
    : targetLanguage === "python"
    ? `- Use list comprehensions and built-in functions
- Follow PEP 8 style guidelines
- Use type hints where beneficial
- Prefer pythonic solutions over verbose code
- Use appropriate data structures (set, dict, deque)`
    : targetLanguage === "java"
    ? `- Use proper access modifiers and naming conventions
- Leverage Collections framework effectively
- Handle exceptions appropriately
- Use StringBuilder for string concatenation
- Follow Java best practices`
    : targetLanguage === "javascript"
    ? `- Use modern ES6+ syntax and features
- Leverage built-in array methods (map, filter, reduce)
- Use const/let instead of var
- Follow JavaScript best practices
- Use appropriate data structures (Set, Map, Array)`
    : targetLanguage === "csharp"
    ? `- Use proper naming conventions (PascalCase, camelCase)
- Leverage LINQ and Collections effectively
- Use var for obvious types, explicit types otherwise
- Follow C# coding standards
- Handle exceptions with try-catch blocks`
    : `- Follow language-specific best practices
- Use appropriate built-in data structures
- Write clean, maintainable code`
}

RETURN ONLY THIS JSON (no extra text):
{
  "solution": "Complete, production-ready code with comments",
  "explanation": "Detailed step-by-step walkthrough of the algorithm with reasoning",
  "timeComplexity": "Big-O notation with explanation",
  "spaceComplexity": "Big-O notation with explanation",
  "approach": "High-level algorithm strategy and key insights",
  "language": "${targetLanguage}",
  "keyOptimizations": ["Specific optimizations used", "Why this approach is optimal"],
  "edgeCases": ["Important edge cases handled", "Boundary conditions considered"],
  "alternativeApproaches": ["Other valid solutions", "Trade-offs compared to chosen approach"]
}

PROBLEM DETAILS:
Title: ${problemInfo.title}
Description: ${problemInfo.description}
Examples: ${JSON.stringify(problemInfo.examples || [], null, 2)}
Constraints: ${JSON.stringify(problemInfo.constraints || [], null, 2)}
Difficulty: ${problemInfo.difficulty || "Not specified"}
Topics: ${JSON.stringify(problemInfo.topics || [], null, 2)}

Generate the optimal ${targetLanguage} solution focusing on interview excellence and code quality:`;

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

  async debugSolution(extractedText, problemInfo, language = null) {
    if (this.apiKeys.length === 0) {
      throw new Error(
        "No Gemini API keys available. Please set GEMINI_API_KEY, GEMINI_API_KEY_2, etc."
      );
    }

    // Use language from problemInfo if available, otherwise use provided language or default to cpp
    const targetLanguage = problemInfo.language || language || "cpp";
    console.log(`🐛 Debugging solution in: ${targetLanguage}`);

    const prompt = `You are an elite debugging specialist and performance optimization expert. Analyze the debugging information and provide enhanced solutions.

DEBUGGING ANALYSIS FRAMEWORK:
1. ERROR IDENTIFICATION: Parse error messages, failed test cases, compiler warnings
2. ROOT CAUSE ANALYSIS: Identify the fundamental issue causing failures
3. PERFORMANCE OPTIMIZATION: Detect bottlenecks and inefficiencies
4. EDGE CASE COVERAGE: Find missing boundary conditions and corner cases
5. CODE QUALITY: Improve readability, maintainability, and best practices

DIAGNOSTIC PRIORITIES:
- Runtime errors (segfaults, null pointers, array bounds)
- Logic errors (wrong algorithms, incorrect conditions)
- Performance issues (timeout, memory limits exceeded)
- Input/output format mismatches
- Off-by-one errors and boundary conditions

RETURN ONLY THIS JSON (no extra text):
{
  "improvedSolution": "Complete, debugged code with all fixes applied",
  "improvements": ["Specific bug fixes made", "Performance optimizations applied", "Code quality enhancements"],
  "debugNotes": "Detailed analysis of what was wrong and why the fixes work",
  "rootCause": "Primary reason for the original failure",
  "testCasesFix": ["Which test cases were failing", "How the fix addresses them"],
  "performanceGains": "Expected improvement in time/space complexity",
  "language": "${targetLanguage}",
  "preventionTips": ["How to avoid similar bugs", "Best practices for this type of problem"],
  "additionalOptimizations": ["Further improvements possible", "Advanced techniques applicable"]
}

ORIGINAL PROBLEM CONTEXT:
Title: ${problemInfo.title}
Description: ${problemInfo.description}
Examples: ${JSON.stringify(problemInfo.examples || [], null, 2)}
Constraints: ${JSON.stringify(problemInfo.constraints || [], null, 2)}

DEBUG INFORMATION FROM SCREENSHOTS:
--- DEBUGGING EVIDENCE ---
${extractedText}
--- END DEBUGGING INFO ---

Analyze the debug information and provide a comprehensive solution with all issues resolved:`;

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
    return this.apiKeys.length > 0;
  }
}

module.exports = GeminiService;
