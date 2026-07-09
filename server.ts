import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

// Lazy initialization of the Gemini API client to prevent server crashes on startup if key is missing
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS middleware to support cross-origin requests
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Increase request size limits to support base64 image uploads comfortably
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoint for converting an image to a detailed Gemini prompt
  app.post("/api/generate-prompt", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image file provided. Please upload an image." });
      }

      // Verify and extract base64 data and mime type
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
      console.error("Error generating prompt with Gemini:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred on the server." });
    }
  });

  // Serve frontend static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Error during server startup:", error);
});
