import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import { verifyNombaSignature } from "./verifySignature";
import { handleNombaWebhook } from "./webhookHandler";
import { supabase } from "./db";

dotenv.config();

const app = express();

// ─── WEBHOOK: capture raw body FIRST, before any other middleware ───
// This ensures we see exactly what arrived, even if Content-Type is weird
app.use("/webhooks/nomba", express.raw({ type: "*/*" }));

// ─── DEBUG LOGGING ───
app.use((req: Request, res: Response, next) => {
  if (req.path === "/webhooks/nomba") {
    const raw = (req as any).body; // express.raw() puts Buffer here

    console.log("=== INCOMING WEBHOOK ===");
    console.log("ALL Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Content-Type:", req.headers["content-type"]);
    console.log(
      "Raw body type:",
      typeof raw,
      "isBuffer:",
      Buffer.isBuffer(raw),
    );
    console.log("Raw body length:", raw?.length ?? 0);

    // Try to parse as JSON for logging (don't mutate req.body yet)
    let parsed = null;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
      console.log("Parsed body:", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("Raw body (not JSON):", raw.toString("utf8").slice(0, 500));
    }

    console.log("========================");

    // Attach parsed body for downstream handlers
    (req as any).parsedBody = parsed;
  }
  next();
});

// Regular JSON parsing for all other routes
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// ... keep all your other routes exactly the same ...

// ─── Webhook ───
app.post("/webhooks/nomba", async (req: Request, res: Response) => {
  // TEMP: acknowledge immediately so Nomba doesn't retry
  res.status(200).send("ok");

  const signature = req.headers["nomba-signature"] as string;
  const timestamp = req.headers["nomba-timestamp"] as string;
  const secret = process.env.NOMBA_WEBHOOK_SECRET as string;

  console.log("Signature header:", signature ? "present" : "MISSING");
  console.log("Timestamp header:", timestamp ? "present" : "MISSING");

  if (!signature || !timestamp) {
    console.error("Missing headers — logging what we have and aborting");
    return;
  }

  const parsedBody = (req as any).parsedBody;
  if (!parsedBody) {
    console.error("Could not parse webhook body as JSON");
    return;
  }

  const isValid = verifyNombaSignature(
    parsedBody,
    signature,
    timestamp,
    secret,
  );
  if (!isValid) {
    console.error("Signature verification failed");
    return;
  }

  try {
    const result = await handleNombaWebhook(parsedBody);
    console.log("Webhook handled:", result);
  } catch (err) {
    console.error("Webhook handler error:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
