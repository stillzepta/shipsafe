// Payment checkout controller
export async function createPaymentSession(amount: number) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("Stripe secret key not configured!");
  return { id: "sess_123", amount };
}
