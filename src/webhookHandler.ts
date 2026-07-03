import { supabase } from "./db";
import { NombaWebhookPayload } from "./types";

export async function handleNombaWebhook(payload: NombaWebhookPayload) {
  const nombaEventId = payload.requestId;

  // 1. Idempotency
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("nomba_event_id", nombaEventId)
    .single();

  if (existing) {
    console.log("Duplicate webhook:", nombaEventId);
    return { status: "duplicate" };
  }

  // 2. Log webhook
  await supabase.from("webhook_events").insert({
    nomba_event_id: nombaEventId,
    payload_json: payload,
    processed_at: new Date().toISOString(),
  });

  // 3. Resolve borrower
  const accountRef = payload.data.transaction.aliasAccountReference;
  if (!accountRef) {
    return { status: "unmatched", reason: "missing_account_ref" };
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id, lender_id, name")
    .eq("account_ref", accountRef)
    .single();

  if (!borrower) {
    return { status: "unmatched", reason: "borrower_not_found" };
  }

  // 4. Find next unpaid installment
  const { data: nextInstallment } = await supabase
    .from("installments")
    .select("id, amount_due, status, due_date, loan_id")
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(1)
    .single();

  if (!nextInstallment) {
    return { status: "unmatched", reason: "no_pending_installment" };
  }

  // 5. Compare amounts (in naira)
  const amountReceived = parseFloat(payload.data.transaction.amount || "0");
  const amountDue = parseFloat(nextInstallment.amount_due);

  // 6. Log payment
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      installment_id: nextInstallment.id,
      borrower_id: borrower.id,
      amount_received: amountReceived,
      sender_name_raw: payload.data.customer?.senderName || null,
      nomba_transaction_id: payload.data.transaction.transactionId,
      status: "pending",
      received_at: payload.data.transaction.time,
    })
    .select()
    .single();

  if (!payment) {
    throw new Error("Failed to create payment record");
  }

  // 7. Exact match
  if (amountReceived === amountDue) {
    await supabase
      .from("installments")
      .update({ status: "paid" })
      .eq("id", nextInstallment.id);

    await supabase
      .from("payments")
      .update({ status: "matched", matched_confidence: 100 })
      .eq("id", payment.id);

    console.log("Exact match:", nextInstallment.id);
    return { status: "matched", paymentId: payment.id, confidence: 100 };
  }

  // 8. Ambiguous — create dispute
  const disputeType = amountReceived < amountDue ? "partial" : "overpaid";

  const { data: dispute } = await supabase
    .from("disputes")
    .insert({
      payment_id: payment.id,
      borrower_id: borrower.id,
      type: disputeType,
      suggested_borrower_id: borrower.id,
      confidence_score: 50,
      reasoning: `Received ₦${amountReceived}, expected ₦${amountDue}. Amount mismatch.`,
      recommended_action: "review",
      merchant_tx_ref: `dispute-${payment.id}-${Date.now()}`,
      status: "open",
    })
    .select()
    .single();

  console.log("Dispute created:", dispute?.id, "Type:", disputeType);
  return { status: "disputed", paymentId: payment.id, disputeId: dispute?.id };
}
