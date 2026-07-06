import { supabase } from "./db";

export async function handleNombaWebhook(payload: any) {
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

  // 3. Defensive field extraction
  const merchant = payload.data?.merchant ?? {};
  const transaction = payload.data?.transaction ?? {};

  const accountRef =
    transaction?.aliasAccountReference ?? payload.data?.aliasAccountReference;

  const rawAmount =
    merchant?.transactionAmount ?? transaction?.transactionAmount ?? "0";

  const transactionId =
    merchant?.transactionId ?? transaction?.transactionId ?? "";

  const receivedAt =
    merchant?.time ?? transaction?.time ?? new Date().toISOString();

  const senderName = payload.data?.customer?.senderName || null;

  console.log("Resolved fields:", {
    accountRef,
    rawAmount,
    transactionId,
    receivedAt,
    senderName,
  });

  // 4. Resolve borrower
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

  // 5. Get ALL pending installments for this borrower in due date order
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

  // 6. Calculate amounts in kobo to avoid float errors
  const amountReceivedKobo = Math.round(parseFloat(String(rawAmount)) * 100);
  const creditBalanceKobo = Math.round(
    parseFloat(borrower.credit_balance || "0") * 100,
  );
  const totalAvailableKobo = amountReceivedKobo + creditBalanceKobo;

  console.log(
    `Payment: ₦${amountReceivedKobo / 100} received + ₦${creditBalanceKobo / 100} credit = ₦${totalAvailableKobo / 100} total available`,
  );

  // 7. Log the incoming payment record
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      installment_id: pendingInstallments[0].id,
      borrower_id: borrower.id,
      amount_received: amountReceivedKobo / 100,
      sender_name_raw: senderName,
      nomba_transaction_id: transactionId,
      status: "pending",
      received_at: receivedAt,
      notes:
        creditBalanceKobo > 0
          ? `Incoming ₦${amountReceivedKobo / 100}. ₦${creditBalanceKobo / 100} credit balance will be auto-applied.`
          : null,
    })
    .select()
    .single();

  if (!payment) throw new Error("Failed to create payment record");

  // 8. If credit balance exists, log its application separately for audit and consume it
  if (creditBalanceKobo > 0) {
    await supabase.from("payments").insert({
      installment_id: pendingInstallments[0].id,
      borrower_id: borrower.id,
      amount_received: creditBalanceKobo / 100,
      sender_name_raw: "Credit Balance",
      nomba_transaction_id: `credit-${transactionId}`,
      status: "matched",
      received_at: receivedAt,
      notes: `Auto-applied ₦${creditBalanceKobo / 100} from existing credit balance for ${borrower.name}`,
      matched_confidence: 100,
    });

    const { error: creditUpdateError } = await supabase
      .from("borrowers")
      .update({ credit_balance: 0 })
      .eq("id", borrower.id);

    if (creditUpdateError) {
      console.error("Failed to consume credit balance:", creditUpdateError);
    }
  }

  // 9. Check for genuine underpayment — less than first installment due
  const firstDueKobo = Math.round(
    parseFloat(pendingInstallments[0].amount_due) * 100,
  );

  if (totalAvailableKobo < firstDueKobo) {
    await supabase
      .from("installments")
      .update({ status: "partial" })
      .eq("id", pendingInstallments[0].id);

    await supabase
      .from("payments")
      .update({
        status: "matched",
        matched_confidence: 100,
        notes: `Underpayment: ₦${totalAvailableKobo / 100} received (incl. credit) vs ₦${firstDueKobo / 100} due. Shortfall: ₦${(firstDueKobo - totalAvailableKobo) / 100}.`,
      })
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

  // 10. Cascade payment forward across installments
  let remainingKobo = totalAvailableKobo;
  let installmentsFullyPaid = 0;
  let lastInstallmentId = pendingInstallments[0].id;

  for (const installment of pendingInstallments) {
    const dueKobo = Math.round(parseFloat(installment.amount_due) * 100);

    if (remainingKobo >= dueKobo) {
      await supabase
        .from("installments")
        .update({
          status: "paid",
          amount_paid: dueKobo / 100,
          amount_remaining: 0,
        })
        .eq("id", installment.id);

      remainingKobo -= dueKobo;
      installmentsFullyPaid++;
      lastInstallmentId = installment.id;

      console.log(
        `Installment #${installment.installment_number} fully paid. Remaining: ₦${remainingKobo / 100}`,
      );

      if (remainingKobo === 0) break;
    } else if (remainingKobo > 0) {
      await supabase
        .from("installments")
        .update({
          status: "partial",
          amount_paid: remainingKobo / 100,
          amount_remaining: (dueKobo - remainingKobo) / 100,
        })
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

  // 11. Store remaining as credit balance
  const creditRemaining = remainingKobo / 100;
  if (creditRemaining > 0) {
    await supabase
      .from("borrowers")
      .update({ credit_balance: creditRemaining })
      .eq("id", borrower.id);

    await supabase.from("payments").insert({
      installment_id: lastInstallmentId,
      borrower_id: borrower.id,
      amount_received: creditRemaining,
      sender_name_raw: "Excess Payment",
      nomba_transaction_id: `excess-${transactionId}`,
      status: "matched",
      received_at: receivedAt,
      notes: `₦${creditRemaining} excess stored as credit balance for future installments`,
      matched_confidence: 100,
    });

    console.log(
      `₦${creditRemaining} stored as credit balance for borrower ${borrower.id}`,
    );
  }

  // 12. Mark original payment as matched
  await supabase
    .from("payments")
    .update({
      status: "matched",
      matched_confidence: 100,
      installment_id: lastInstallmentId,
      notes:
        creditRemaining > 0
          ? `Payment matched. ₦${creditRemaining} excess stored as credit. ${installmentsFullyPaid} installment(s) fully paid.`
          : `Payment matched. ${installmentsFullyPaid} installment(s) fully paid.`,
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
