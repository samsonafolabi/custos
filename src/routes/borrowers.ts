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

  // Validate required fields
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

  // Validate numeric fields
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

  try {
    // 1. Authenticate with Nomba
    const token = await getNombaToken("live");

    // 2. Create virtual account (need this for the borrower's bank_account_number)
    const accountRef = `borrower-${Date.now()}`;
    const { bankAccountNumber, accountHolderId } = await createVirtualAccount(
      accountRef,
      name,
      token,
    );

    // 3. Get lender (must exist before saving borrower)
    const { data: lender } = await supabase
      .from("lenders")
      .select("id")
      .limit(1)
      .single();

    if (!lender) throw new Error("No lender found in database");

    // 4. Save borrower to DB FIRST
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

    // 5. Save loan to DB
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

    // 6. Generate installments (first due 1 month after startDate)
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

    // 7. Disburse loan ONLY after everything is persisted
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
    console.error("Create borrower error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create borrower",
    });
  }
});

export default router;
