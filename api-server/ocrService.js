const Tesseract = require("tesseract.js");
const sharp = require("sharp");

class OCRService {
  constructor() {
    console.log("🔍 OCR Service initialized with Tesseract.js");
  }

  /**
   * Preprocess image for better OCR results
   */
  async preprocessImage(base64Image) {
    try {
      // Remove data URL prefix if present
      const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");
      const imageBuffer = Buffer.from(imageData, "base64");

      // Enhance image for better OCR results
      const processedBuffer = await sharp(imageBuffer)
        .resize(null, 1200, {
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      console.error("Error preprocessing image:", error);
      // Return original if preprocessing fails
      const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, "");
      return Buffer.from(imageData, "base64");
    }
  }

  /**
   * Extract text from a single image using OCR
   */
  async extractTextFromImage(base64Image) {
    try {
      console.log("🔍 Starting OCR text extraction...");

      // Preprocess image for better OCR
      const processedImage = await this.preprocessImage(base64Image);

      // Configure Tesseract for better accuracy
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      // Set parameters for better code/text recognition
      await worker.setParameters({
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,;:!?()[]{}+-*/=<>\"'\n\t",
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: "1",
      });

      const {
        data: { text },
      } = await worker.recognize(processedImage);
      await worker.terminate();

      console.log(`✅ OCR completed. Extracted ${text.length} characters`);
      return text.trim();
    } catch (error) {
      console.error("Error in OCR text extraction:", error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract text from multiple images and combine
   */
  async extractTextFromImages(base64Images) {
    try {
      if (!Array.isArray(base64Images) || base64Images.length === 0) {
        throw new Error("No images provided for OCR");
      }

      console.log(`🔍 Starting OCR for ${base64Images.length} images...`);

      const extractedTexts = [];

      for (let i = 0; i < base64Images.length; i++) {
        console.log(`Processing image ${i + 1}/${base64Images.length}...`);
        const text = await this.extractTextFromImage(base64Images[i]);
        if (text && text.length > 10) {
          // Only include meaningful text
          extractedTexts.push(`--- Image ${i + 1} ---\n${text}`);
        }
      }

      if (extractedTexts.length === 0) {
        throw new Error(
          "No meaningful text could be extracted from the images"
        );
      }

      const combinedText = extractedTexts.join("\n\n");
      console.log(
        `✅ OCR completed for all images. Total text length: ${combinedText.length}`
      );

      return combinedText;
    } catch (error) {
      console.error("Error in batch OCR:", error);
      throw new Error(`Batch OCR failed: ${error.message}`);
    }
  }

  /**
   * Clean and structure the extracted text for problem analysis
   */
  cleanExtractedText(rawText) {
    try {
      // Remove excessive whitespace and normalize line breaks
      let cleanText = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

      // Try to identify common problem statement sections
      const sections = {
        title: "",
        description: "",
        examples: [],
        constraints: [],
        raw: cleanText,
      };

      // Simple heuristics to extract structured information
      const lines = cleanText
        .split("\n")
        .filter((line) => line.trim().length > 0);

      // Look for title (usually first significant line or contains "Problem" or numbers)
      const titlePatterns = [
        /^\d+\.\s+(.+)/, // "1. Two Sum"
        /^Problem\s*:?\s*(.+)/i, // "Problem: Two Sum"
        /^(.+?)(?:\s*-\s*(?:Easy|Medium|Hard))?$/, // First line heuristic
      ];

      for (const line of lines.slice(0, 3)) {
        for (const pattern of titlePatterns) {
          const match = line.match(pattern);
          if (match && !sections.title) {
            sections.title = match[1]?.trim() || line.trim();
            break;
          }
        }
        if (sections.title) break;
      }

      // If no title found, use first meaningful line
      if (!sections.title && lines.length > 0) {
        sections.title = lines[0].trim();
      }

      return sections;
    } catch (error) {
      console.error("Error cleaning extracted text:", error);
      return {
        title: "Extracted Problem",
        description: rawText,
        examples: [],
        constraints: [],
        raw: rawText,
      };
    }
  }
}

module.exports = OCRService;
