import Tesseract from "tesseract.js";

export async function extractTextFromImage(
  imageBase64: string
): Promise<string> {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBase64, "eng");
  console.log("Extracted text:", text);
  return text;
}
