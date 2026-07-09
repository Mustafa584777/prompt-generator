import Razorpay from "razorpay";

let rzpClient: any = null;

export function getRazorpayClient() {
  if (!rzpClient) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing.");
    }
    rzpClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return rzpClient;
}

export async function createRazorpayOrder(amountInPaise: number, currency: string = "INR") {
  const rzp = getRazorpayClient();
  const options = {
    amount: amountInPaise,
    currency,
    receipt: `receipt_order_${Date.now()}`,
  };
  return await rzp.orders.create(options);
}
