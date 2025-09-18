const { execFile } = require("child_process");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const execFileAsync = promisify(execFile);

class OCRService {
  constructor() {
    console.log("OCR Service created - will use Tesseract CLI");
  }

  async preprocessImage(base64Image, index = 0) {
    try {
      // Remove data URL prefix if present
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      console.log(`Processing image of size: ${imageBuffer.length} bytes`);

      // Generate debug file path
      const debugDir = path.join(__dirname, "debug");
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
      }
      const originalImagePath = path.join(
        debugDir,
        `image_${index}_original.png`
      );
      const processedImagePath = path.join(
        debugDir,
        `image_${index}_processed.png`
      );

      // Save original image for debugging
      try {
        await writeFile(originalImagePath, imageBuffer);
        console.log(`Original image saved to: ${originalImagePath}`);
      } catch (err) {
        console.log(`Couldn't save original image: ${err.message}`);
      }

      // Enhanced image processing for better OCR results
      const processed = await sharp(imageBuffer)
        .grayscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen the image
        .toBuffer();

      // Save processed image for debugging
      try {
        await writeFile(processedImagePath, processed);
        console.log(`Processed image saved to: ${processedImagePath}`);
      } catch (err) {
        console.log(`Couldn't save processed image: ${err.message}`);
      }

      return processed;
    } catch (error) {
      console.error("Image preprocessing failed:", error);
      // If preprocessing fails, return original image buffer
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(base64Data, "base64");
    }
  }

  async extractTextFromImage(base64Image, index = 0) {
    try {
      console.log("🔍 Processing image with Tesseract CLI...");
      // Preprocess the image for better OCR results
      const processedImage = await this.preprocessImage(base64Image, index);

      // Save processed image to a temp file
      const tempDir = path.join(__dirname, "tmp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      const tempImagePath = path.join(tempDir, `image_${index}_tess.png`);
      await writeFile(tempImagePath, processedImage);

      // Output file (Tesseract CLI will add .txt)
      const tempOutputPath = path.join(tempDir, `output_${index}`);

      // Run tesseract CLI
      const tesseractArgs = [
        tempImagePath,
        tempOutputPath,
        "-l",
        "eng",
        "--psm",
        "6",
      ];
      await execFileAsync("tesseract", tesseractArgs);

      // Read the output text
      const outputTextPath = tempOutputPath + ".txt";
      let extractedText = "";
      try {
        extractedText = fs.readFileSync(outputTextPath, "utf8").trim();
      } catch (err) {
        console.error("Failed to read Tesseract output:", err);
      }

      // Clean up temp files (optional, can be commented out for debugging)
      try {
        fs.unlinkSync(tempImagePath);
        fs.unlinkSync(outputTextPath);
      } catch (err) {
        // Ignore cleanup errors
      }

      console.log("\n============ EXTRACTED TEXT START ============");
      console.log(extractedText);
      console.log("============= EXTRACTED TEXT END =============\n");

      return extractedText;
    } catch (error) {
      console.error("OCR processing error (Tesseract CLI):", error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  async processImageBatch(base64Images) {
    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      throw new Error("No images provided for OCR processing");
    }

    try {
      console.log(
        `🔄 Processing batch of ${base64Images.length} images with OCR`
      );

      // Process images sequentially to avoid worker issues
      const results = [];
      for (let i = 0; i < base64Images.length; i++) {
        try {
          console.log(`Processing image ${i + 1}/${base64Images.length}`);
          const text = await this.extractTextFromImage(base64Images[i], i);
          results.push(text);
        } catch (error) {
          console.error(`Failed to process image ${i + 1}:`, error.message);
          results.push(""); // Return empty string for failed images
        }
      }

      // Filter out empty results
      const validResults = results.filter((text) => text.trim().length > 0);

      // Log all valid extracted texts for verification
      if (validResults.length > 0) {
        console.log("\n========== ALL EXTRACTED TEXTS ==========");
        validResults.forEach((text, idx) => {
          console.log(`\n--- IMAGE ${idx + 1} TEXT ---`);
          console.log(text);
          console.log("-----------------------------");
        });
        console.log("=========================================\n");
      }

      if (validResults.length === 0) {
        console.warn("⚠️ No valid text extracted from any images in the batch");
      } else {
        console.log(
          `✅ Successfully extracted text from ${validResults.length}/${base64Images.length} images`
        );
      }

      return validResults;
    } catch (error) {
      console.error("❌ Batch processing failed:", error);
      throw new Error(`OCR batch processing failed: ${error.message}`);
    }
  }

  async terminate() {
    // No-op for CLI version
  }
}

module.exports = OCRService;
