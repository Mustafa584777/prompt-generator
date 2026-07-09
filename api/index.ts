import express from "express";
import dotenv from "dotenv";
import { handleConfig } from "./config";
import { handleCreateOrder } from "./create-order";
import { handleOCR } from "./ocr";
import { handleVerifyPayment } from "./verify-payment";

dotenv.config();

const app = express();

// Enable CORS middleware to support cross-origin requests from the custom domain
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

// Increase JSON payload capacity to comfortably receive base64 photo transfers on Vercel
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Core API Routes
app.get("/api/config", handleConfig);
app.post("/api/create-order", handleCreateOrder);
app.post("/api/verify-payment", handleVerifyPayment);
app.post("/api/generate-prompt", handleOCR);

// Diagnostic check route for Vercel
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Vercel serverless function is live!" });
});

export default app;
