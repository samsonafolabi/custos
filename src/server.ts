import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import { verifyNombaSignature } from "./verifySignature";
import { handleNombaWebhook } from "./webhookHandler";
import { supabase } from "./db";

dotenv.config();

const app = express();

// Parse JSON regardless of the Content-Type header Nomba sends —
// this is the fix for req.body coming through as undefined.
app.use(express.json({ type: () => true }));

app.use((req: Request, res: Response, next) => {
  if (req.path === "/webhooks/nomba") {
    console.log("=== INCOMING WEBHOOK ===");
    console.log("Method/URL:", req.method, req.originalUrl);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("========================");
  }
  next();
});
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("Custos is alive");
});

// ─── Portfolio ───
app.get("/api/portfolio", async (req: Request, res: Response) => {
  const { data: borrowers, error } = await supabase.from("borrowers").select(`
    id, name, phone, account_ref, bank_account_number,
    loans (
      id, principal_amount, installment_amount, num_installments, status,
      installments (
        id, installment_number, amount_due, due_date, status
      )
    )
  `);

  if (error) {
    console.error("Portfolio error:", error);
    return res.status(500).json({ error: "Failed to fetch portfolio" });
  }
  return res.json(borrowers);
});

// ─── Disputes ───
app.get("/api/disputes", async (req: Request, res: Response) => {
  const { data: disputes, error } = await supabase
    .from("disputes")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Disputes error:", error);
    return res.status(500).json({ error: error.message });
  }
  if (!disputes || disputes.length === 0) return res.json([]);

  const borrowerIds = disputes.map((d) => d.borrower_id).filter(Boolean);
  const paymentIds = disputes.map((d) => d.payment_id).filter(Boolean);

  const { data: borrowers } = await supabase
    .from("borrowers")
    .select("id, name, phone")
    .in("id", borrowerIds);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_received, sender_name_raw, received_at")
    .in("id", paymentIds);

  const borrowerMap = new Map(borrowers?.map((b) => [b.id, b]) || []);
  const paymentMap = new Map(payments?.map((p) => [p.id, p]) || []);

  const enriched = disputes.map((d) => ({
    ...d,
    borrowers: borrowerMap.get(d.borrower_id) || null,
    payments: paymentMap.get(d.payment_id) || null,
  }));

  return res.json(enriched);
});

// ─── Aging ───
app.get("/api/aging", async (req: Request, res: Response) => {
  const today = new Date().toISOString().split("T")[0];

  const { data: overdue, error } = await supabase
    .from("installments")
    .select(
      `
      id, installment_number, amount_due, due_date, status,
      loans (
        id,
        borrowers ( id, name, phone )
      )
    `,
    )
    .in("status", ["pending", "partial"])
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Aging error:", error);
    return res.status(500).json({ error: "Failed to fetch aging" });
  }
  return res.json(overdue);
});

// ─── Resolve Dispute ───
app.post("/api/disputes/:id/resolve", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  const validActions = ["claimed", "refunded", "written_off"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  // Get dispute
  const { data: dispute } = await supabase
    .from("disputes")
    .select("*, payments (*)")
    .eq("id", id)
    .single();

  if (!dispute) {
    return res.status(404).json({ error: "Dispute not found" });
  }

  // Update dispute
  await supabase
    .from("disputes")
    .update({
      status: action,
      resolution_notes: notes || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  // If claimed, update payment and installment
  if (action === "claimed") {
    await supabase
      .from("payments")
      .update({ status: "matched" })
      .eq("id", dispute.payment_id);

    const { data: payment } = await supabase
      .from("payments")
      .select("installment_id")
      .eq("id", dispute.payment_id)
      .single();

    if (payment?.installment_id) {
      await supabase
        .from("installments")
        .update({ status: "paid" })
        .eq("id", payment.installment_id);
    }
  }

  return res.json({ success: true, action });
});

// ─── Dashboard ───
app.get("/dashboard", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ─── Webhook ───
app.post("/webhooks/nomba", async (req: Request, res: Response) => {
  // TEMP: acknowledge immediately so Nomba doesn't retry/flag the endpoint
  // while we confirm signature verification is working end-to-end.
  // REMOVE this early response once verified — as written it accepts
  // any request before checking the signature.
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
    await handleNombaWebhook(req.body);
  } catch (err) {
    console.error("Webhook error:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
