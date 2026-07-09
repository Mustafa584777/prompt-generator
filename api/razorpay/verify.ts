import crypto from "crypto";

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("Razorpay secret key is not configured.");
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${orderId}|${paymentId}`);
  const generatedSignature = hmac.digest("hex");

  return generatedSignature === signature;
}
