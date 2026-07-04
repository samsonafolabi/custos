import { Router, Request, Response } from "express";
import { supabase } from "../db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
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

export default router;
