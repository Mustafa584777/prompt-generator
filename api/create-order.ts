import { Request, Response } from "express";
import { createRazorpayOrder } from "./razorpay/order";

export async function handleCreateOrder(req: Request, res: Response) {
  try {
    const { amount, currency = "INR" } = req.body;
    if (!amount) {
      return res.status(400).json({ error: "Amount is required." });
    }

    const amountInPaise = parseInt(amount, 10);
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ error: "Amount must be at least 100 paise (1 INR)." });
    }

    const order = await createRazorpayOrder(amountInPaise, currency);
    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error("Error in handleCreateOrder:", error);
    res.status(500).json({ error: error.message || "Failed to create Razorpay order." });
  }
}
