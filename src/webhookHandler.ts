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
    .select("id, lender_id, name, credit_balance")
    .eq("account_ref", accountRef)
    .single();

  if (!borrower) {
    return { status: "unmatched", reason: "borrower_not_found" };
  }

  // 4. Get ALL pending installments for this borrower
  const { data: pendingInstallments } = await supabase
    .from("installments")
    .select(
      "id, amount_due, status, due_date, installment_number, loan_id, loans!inner(borrower_id)",
    )
    .eq("loans.borrower_id", borrower.id)
    .in("status", ["pending", "partial"])
    .order("due_date", { ascending: true });

  if (!pendingInstallments || pendingInstallments.length === 0) {
    return { status: "unmatched", reason: "no_pending_installment" };
  }

  // 5. Calculate amounts in kobo
  const amountReceivedKobo = Math.round(
    parseFloat(String(payload.data.transaction.transactionAmount ?? "0")) * 100,
  );
  const creditBalanceKobo = Math.round(
    parseFloat(borrower.credit_balance || "0") * 100,
  );
  const totalAvailableKobo = amountReceivedKobo + creditBalanceKobo;

  // 6. Log payment
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      installment_id: pendingInstallments[0].id,
      borrower_id: borrower.id,
      amount_received: amountReceivedKobo / 100,
      sender_name_raw: payload.data.customer?.senderName || null,
      nomba_transaction_id: payload.data.transaction.transactionId,
      status: "pending",
      received_at: payload.data.transaction.time,
    })
    .select()
    .single();

  if (!payment) throw new Error("Failed to create payment record");

  // 7. Cascade payment across installments
  let remainingKobo = totalAvailableKobo;
  let installmentsFullyPaid = 0;
  let installmentsPartiallyCovered = 0;
  let lastPartialInstallmentId: string | null = null;

  for (const installment of pendingInstallments) {
    const dueKobo = Math.round(parseFloat(installment.amount_due) * 100);

    if (remainingKobo >= dueKobo) {
      // Fully pay this installment
      await supabase
        .from("installments")
        .update({ status: "paid" })
        .eq("id", installment.id);

      remainingKobo -= dueKobo;
      installmentsFullyPaid++;

      console.log(
        `Installment #${installment.installment_number} fully paid. Remaining: ₦${remainingKobo / 100}`,
      );

      if (remainingKobo === 0) break;
    } else if (remainingKobo > 0) {
      // Partially cover this installment
      await supabase
        .from("installments")
        .update({ status: "partial" })
        .eq("id", installment.id);

      lastPartialInstallmentId = installment.id;
      installmentsPartiallyCovered++;

      console.log(
        `Installment #${installment.installment_number} partial: ₦${remainingKobo / 100} of ₦${dueKobo / 100}`,
      );

      // Remainder becomes credit
      break;
    } else {
      // No money left, stop
      break;
    }
  }

  // 8. Store remaining as credit balance
  const creditRemaining = remainingKobo / 100;

  await supabase
    .from("borrowers")
    .update({ credit_balance: creditRemaining })
    .eq("id", borrower.id);

  // 9. Mark payment as matched
  await supabase
    .from("payments")
    .update({
      status: "matched",
      matched_confidence: 100,
      installment_id: lastPartialInstallmentId || pendingInstallments[0].id,
    })
    .eq("id", payment.id);

  // 10. Only create dispute if UNDERPAID (total < first installment due)
  const firstDueKobo = Math.round(
    parseFloat(pendingInstallments[0].amount_due) * 100,
  );

  if (totalAvailableKobo < firstDueKobo && installmentsFullyPaid === 0) {
    // True underpayment — create partial dispute
    const { data: dispute } = await supabase
      .from("disputes")
      .insert({
        payment_id: payment.id,
        borrower_id: borrower.id,
        type: "partial",
        suggested_borrower_id: borrower.id,
        confidence_score: 95,
        reasoning: `Received ₦${totalAvailableKobo / 100}, expected ₦${firstDueKobo / 100}. Shortfall of ₦${(firstDueKobo - totalAvailableKobo) / 100}.`,
        recommended_action: "review",
        merchant_tx_ref: `dispute-${payment.id}-${Date.now()}`,
        status: "open",
      })
      .select()
      .single();

    return {
      status: "disputed",
      paymentId: payment.id,
      disputeId: dispute?.id,
      shortfall: (firstDueKobo - totalAvailableKobo) / 100,
    };
  }

  // Success — no dispute needed
  return {
    status: "matched",
    paymentId: payment.id,
    installmentsFullyPaid,
    installmentsPartiallyCovered,
    creditRemaining,
    totalApplied: totalAvailableKobo / 100,
  };
}
