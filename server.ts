import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";

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

  // Initialize Razorpay client lazily to prevent crashes if credentials are unset
  let razorpayInstance: any = null;

  function getRazorpayInstance() {
    if (!razorpayInstance) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new Error("Razorpay API keys are missing. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
      }
      razorpayInstance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return razorpayInstance;
  }

  // Razorpay endpoint: Create Order
  app.post("/api/razorpay/create-order", async (req, res) => {
    try {
      const { amount, currency } = req.body;
      
      // Default to ₹199 (19900 paise) if amount not provided
      const orderAmount = amount ? Math.round(amount * 100) : 19900; 
      const orderCurrency = currency || "INR";
      
      const razorpay = getRazorpayInstance();
      const options = {
        amount: orderAmount,
        currency: orderCurrency,
        receipt: `receipt_order_${Date.now()}`,
      };
      
      const order = await razorpay.orders.create(options);
      
      res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID
      });
    } catch (error: any) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ error: error.message || "Failed to create Razorpay order." });
    }
  });

  // Razorpay endpoint: Verify Payment Signature
  app.post("/api/razorpay/verify-payment", async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required Razorpay payment verification parameters." });
      }
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error("Razorpay secret key is missing on the server.");
      }
      
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
        
      if (generatedSignature === razorpay_signature) {
        res.json({ status: "success", message: "Payment verified successfully." });
      } else {
        res.status(400).json({ error: "Invalid payment signature verification failed." });
      }
    } catch (error: any) {
      console.error("Error verifying payment signature:", error);
      res.status(500).json({ error: error.message || "Failed to verify Razorpay payment." });
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
