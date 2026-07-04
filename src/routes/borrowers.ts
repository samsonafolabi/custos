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

  try {
    // 1. Authenticate
    const token = await getNombaToken("live");

    // 2. Create virtual account
    const accountRef = `borrower-${Date.now()}`;
    const { bankAccountNumber, accountHolderId } = await createVirtualAccount(
      accountRef,
      name,
      token,
    );

    // 3. Disburse loan
    const transferRef = `loan-${accountRef}`;
    const disbursement = await disburseLoan({
      amount: principalAmount,
      transferRef,
      recipientName: name,
      recipientAccountNumber,
      recipientBankCode,
      narration: `Loan disbursement — ${name}`,
      token,
    });

    // 4. Get lender
    const { data: lender } = await supabase
      .from("lenders")
      .select("id")
      .limit(1)
      .single();

    if (!lender) throw new Error("No lender found in database");

    // 5. Save borrower
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

    // 6. Save loan
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

    // 7. Generate installments
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
    console.error("Create borrower error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create borrower",
    });
  }
});

export default router;
