import { Request, Response } from "express";
import { verifyRazorpaySignature } from "./razorpay/verify";

export async function handleVerifyPayment(req: Request, res: Response) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required signature verification parameters." });
    }

    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (isValid) {
      res.json({ success: true, message: "Payment verified successfully." });
    } else {
      res.status(400).json({ success: false, error: "Signature verification failed." });
    }
  } catch (error: any) {
    console.error("Error in handleVerifyPayment:", error);
    res.status(500).json({ error: error.message || "An error occurred during payment verification." });
  }
}
