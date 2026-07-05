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

  // 3. Resolve borrower via aliasAccountReference (lives at data level, not transaction)
  const accountRef = payload.data.aliasAccountReference;
  if (!accountRef) {
    console.log("No aliasAccountReference in payload");
    return { status: "unmatched", reason: "missing_account_ref" };
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id, lender_id, name, credit_balance")
    .eq("account_ref", accountRef)
    .single();

  if (!borrower) {
    console.log("Borrower not found for account_ref:", accountRef);
    return { status: "unmatched", reason: "borrower_not_found" };
  }

  // 4. Get ALL pending installments for this borrower in due date order
  const { data: pendingInstallments } = await supabase
    .from("installments")
    .select(
      "id, amount_due, status, due_date, installment_number, loan_id, loans!inner(borrower_id)",
    )
    .eq("loans.borrower_id", borrower.id)
    .in("status", ["pending", "partial"])
    .order("due_date", { ascending: true });

  if (!pendingInstallments || pendingInstallments.length === 0) {
    console.log("No pending installments for borrower:", borrower.id);
    return { status: "unmatched", reason: "no_pending_installment" };
  }

  // 5. Calculate amounts in kobo to avoid float errors
  // transactionAmount lives at data.merchant.transactionAmount
  const amountReceivedKobo = Math.round(
    parseFloat(String(payload.data.merchant.transactionAmount ?? "0")) * 100,
  );
  const creditBalanceKobo = Math.round(
    parseFloat(borrower.credit_balance || "0") * 100,
  );
  const totalAvailableKobo = amountReceivedKobo + creditBalanceKobo;

  console.log(
    `Payment: ₦${amountReceivedKobo / 100} received + ₦${creditBalanceKobo / 100} credit = ₦${totalAvailableKobo / 100} total available`,
  );

  // 6. Log payment record against first pending installment
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      installment_id: pendingInstallments[0].id,
      borrower_id: borrower.id,
      amount_received: amountReceivedKobo / 100,
      sender_name_raw: payload.data.customer?.senderName || null,
      nomba_transaction_id: payload.data.merchant.transactionId,
      status: "pending",
      received_at: payload.data.merchant.time || new Date().toISOString(),
    })
    .select()
    .single();

  if (!payment) throw new Error("Failed to create payment record");

  // 7. Check if total available is less than first installment due — genuine underpayment
  const firstDueKobo = Math.round(
    parseFloat(pendingInstallments[0].amount_due) * 100,
  );

  if (totalAvailableKobo < firstDueKobo) {
    // True underpayment — mark partial and create dispute
    await supabase
      .from("installments")
      .update({ status: "partial" })
      .eq("id", pendingInstallments[0].id);

    // Consume any credit balance
    await supabase
      .from("borrowers")
      .update({ credit_balance: 0 })
      .eq("id", borrower.id);

    await supabase
      .from("payments")
      .update({ status: "matched", matched_confidence: 100 })
      .eq("id", payment.id);

    const { data: dispute } = await supabase
      .from("disputes")
      .insert({
        payment_id: payment.id,
        borrower_id: borrower.id,
        type: "partial",
        suggested_borrower_id: borrower.id,
        confidence_score: 95,
        reasoning: `Received ₦${amountReceivedKobo / 100}${creditBalanceKobo > 0 ? ` + ₦${creditBalanceKobo / 100} credit` : ""} = ₦${totalAvailableKobo / 100} total. Expected ₦${firstDueKobo / 100}. Shortfall of ₦${(firstDueKobo - totalAvailableKobo) / 100}.`,
        recommended_action: "review",
        merchant_tx_ref: `dispute-${payment.id}-${Date.now()}`,
        status: "open",
      })
      .select()
      .single();

    console.log(`Underpayment dispute created: ${dispute?.id}`);
    return {
      status: "disputed",
      paymentId: payment.id,
      disputeId: dispute?.id,
      shortfall: (firstDueKobo - totalAvailableKobo) / 100,
    };
  }

  // 8. Cascade payment forward across installments
  let remainingKobo = totalAvailableKobo;
  let installmentsFullyPaid = 0;
  let lastInstallmentId = pendingInstallments[0].id;

  for (const installment of pendingInstallments) {
    const dueKobo = Math.round(parseFloat(installment.amount_due) * 100);

    if (remainingKobo >= dueKobo) {
      await supabase
        .from("installments")
        .update({ status: "paid" })
        .eq("id", installment.id);

      remainingKobo -= dueKobo;
      installmentsFullyPaid++;
      lastInstallmentId = installment.id;

      console.log(
        `Installment #${installment.installment_number} fully paid. Remaining: ₦${remainingKobo / 100}`,
      );

      if (remainingKobo === 0) break;
    } else if (remainingKobo > 0) {
      // Partial coverage of this installment — store remainder as credit
      await supabase
        .from("installments")
        .update({ status: "partial" })
        .eq("id", installment.id);

      lastInstallmentId = installment.id;

      console.log(
        `Installment #${installment.installment_number} partially covered: ₦${remainingKobo / 100} of ₦${dueKobo / 100}`,
      );
      break;
    } else {
      break;
    }
  }

  // 9. Store remaining amount as credit balance
  const creditRemaining = remainingKobo / 100;
  await supabase
    .from("borrowers")
    .update({ credit_balance: creditRemaining })
    .eq("id", borrower.id);

  if (creditRemaining > 0) {
    console.log(
      `₦${creditRemaining} stored as credit balance for borrower ${borrower.id}`,
    );
  }

  // 10. Mark payment as matched
  await supabase
    .from("payments")
    .update({
      status: "matched",
      matched_confidence: 100,
      installment_id: lastInstallmentId,
    })
    .eq("id", payment.id);

  console.log(
    `Webhook handled: ${installmentsFullyPaid} installments paid, ₦${creditRemaining} credit remaining`,
  );

  return {
    status: "matched",
    paymentId: payment.id,
    installmentsFullyPaid,
    creditRemaining,
    totalApplied: totalAvailableKobo / 100,
  };
}
