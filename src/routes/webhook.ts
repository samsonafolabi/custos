import { Router, Request, Response } from "express";
import { verifyNombaSignature } from "../verifySignature";
import { handleNombaWebhook } from "../webhookHandler";

const router = Router();

router.post("/nomba", async (req: Request, res: Response) => {
  // ACK immediately — prevents Nomba retry storms on slow DB writes
  res.status(200).send("ok");

  const signature = req.headers["nomba-signature"] as string;
  const timestamp = req.headers["nomba-timestamp"] as string;
  const secret = process.env.NOMBA_WEBHOOK_SECRET as string;

  if (!signature || !timestamp) {
    console.error("Missing signature/timestamp headers");
    return;
  }

  const isValid = verifyNombaSignature(req.body, signature, timestamp, secret);
  if (!isValid) {
    console.error("Invalid signature");
    return;
  }

  try {
    const result = await handleNombaWebhook(req.body);
    console.log("Webhook handled:", result);
  } catch (err) {
    console.error(
      "Webhook processing error:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }
});

export default router;
