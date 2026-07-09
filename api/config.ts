import { Request, Response } from "express";

export async function handleConfig(req: Request, res: Response) {
  try {
    res.json({
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load config." });
  }
}
