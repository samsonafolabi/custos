import { Router, Request, Response } from "express";
import { supabase } from "../db";
import {
  getNombaToken,
  createVirtualAccount,
  disburseLoan,
} from "../services/nomba";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const {
    name,
    phone,
    recipientAccountNumber,
    recipientBankCode,
    recipientBankName,
    principalAmount,
    installmentAmount,
    numInstallments,
    startDate,
  } = req.body;

  if (
    !name ||
    !phone ||
    !recipientAccountNumber ||
    !recipientBankCode ||
    !principalAmount ||
    !installmentAmount ||
    !numInstallments ||
    !startDate
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (
    typeof principalAmount !== "number" ||
    principalAmount <= 0 ||
    typeof installmentAmount !== "number" ||
    installmentAmount <= 0 ||
    typeof numInstallments !== "number" ||
    numInstallments <= 0 ||
    !Number.isInteger(numInstallments)
  ) {
    return res.status(400).json({
      error:
        "principalAmount, installmentAmount, and numInstallments must be positive numbers",
    });
  }

  // Track what we've created so we can report clearly on failure
  let accountRef: string | null = null;
  let bankAccountNumber: string | null = null;
  let accountHolderId: string | null = null;

  try {
    // 1. Authenticate
    const token = await getNombaToken("live");

    // 2. Create virtual account
    accountRef = `borrower-${Date.now()}`;
    const va = await createVirtualAccount(accountRef, name, token);
    bankAccountNumber = va.bankAccountNumber;
    accountHolderId = va.accountHolderId;

    // 3. Disburse FIRST — before any DB writes
    // If this fails, no DB records exist yet, so nothing to roll back
    const transferRef = `loan-${accountRef}`;
    const disbursement = await disburseLoan({
      amount: principalAmount,
      transferRef,
      recipientName: name,
      recipientAccountNumber,
      recipientBankCode,
      recipientBankName,
      narration: `Loan disbursement — ${name}${recipientBankName ? ` (${recipientBankName})` : ""}`,
      token,
    });

    // 4. Disbursement confirmed — now safe to write to DB
    const { data: lender } = await supabase
      .from("lenders")
      .select("id")
      .limit(1)
      .single();

    if (!lender) throw new Error("No lender found in database");

    const { data: borrower } = await supabase
      .from("borrowers")
      .insert({
        lender_id: lender.id,
        name,
        phone,
        account_ref: accountRef,
        account_holder_id: accountHolderId,
        bank_account_number: bankAccountNumber,
      })
      .select()
      .single();

    if (!borrower) throw new Error("Failed to save borrower");

    const { data: loan } = await supabase
      .from("loans")
      .insert({
        borrower_id: borrower.id,
        principal_amount: principalAmount,
        installment_amount: installmentAmount,
        num_installments: numInstallments,
        start_date: startDate,
        status: "active",
      })
      .select()
      .single();

    if (!loan) throw new Error("Failed to save loan");

    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      await supabase.from("installments").insert({
        loan_id: loan.id,
        installment_number: i,
        amount_due: installmentAmount,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
      });
    }

    return res.status(201).json({
      success: true,
      borrower: { id: borrower.id, name, bankAccountNumber, accountRef },
      loan: {
        id: loan.id,
        principalAmount,
        installmentAmount,
        numInstallments,
      },
      disbursement,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create borrower";
    console.error("Create borrower error:", message);

    // If VA was created but disbursement failed, log the orphaned account
    // so it can be manually cleaned up or retried
    if (accountRef && bankAccountNumber) {
      console.error(
        `⚠️ Orphaned virtual account — disbursement failed after VA creation.\n` +
          `  accountRef: ${accountRef}\n` +
          `  bankAccountNumber: ${bankAccountNumber}\n` +
          `  No DB records were saved. Safe to retry.`,
      );
    }

    return res.status(500).json({
      error: message,
      // Tell the frontend whether it's safe to retry
      // (VA exists at Nomba but no DB record — retry will create a new VA)
      canRetry: true,
    });
  }
});

export default router;
