import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Please configure it in your environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiClient;
}

export async function handleOCR(req: Request, res: Response) {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image file provided. Please upload an image." });
    }

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid image format received." });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const ai = getAiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `Analyze this image in detail and convert it into a highly descriptive and beautifully structured prompt.
Your response must contain:
1. **Subject Description**: A clear description of the main focus, characters, objects, or scenery.
2. **Composition & Angle**: The camera framing, view angle, depth of field, and layout.
3. **Style & Aesthetics**: The visual style (e.g. photorealistic, cinematic, oil painting, 3D render, minimalist, retro illustration).
4. **Lighting & Color**: The tone, light source (e.g. golden hour, dramatic studio lighting, neon glow), color palette, and saturation.
5. **Mood & Atmosphere**: The emotions, vibe, and energy conveyed.

Format the output as a cohesive prompt that a user can copy and paste into Gemini or Imagen to generate a highly similar image. 
At the very end of your response, provide 4-6 comma-separated keyword tags. Let your response be direct, highly professional, and inspiring!`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
    });

    if (!response.text) {
      return res.status(500).json({ error: "Gemini failed to generate a response text." });
    }

    res.json({ prompt: response.text });
  } catch (error: any) {
    console.error("Error in handleOCR:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred on the server." });
  }
}
