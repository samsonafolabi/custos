import { Router, Request, Response } from "express";
import { supabase } from "../db";

const router = Router();

// ─── List open disputes ───
router.get("/", async (req: Request, res: Response) => {
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

// ─── Resolve dispute ───
router.post("/:id/resolve", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, notes } = req.body;

  const validActions = ["claimed", "refunded", "written_off"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const { data: dispute } = await supabase
    .from("disputes")
    .select("*, payments (*)")
    .eq("id", id)
    .single();

  if (!dispute) {
    return res.status(404).json({ error: "Dispute not found" });
  }

  await supabase
    .from("disputes")
    .update({
      status: action,
      resolution_notes: notes || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

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

export default router;
