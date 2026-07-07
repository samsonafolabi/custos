import { Router, Request, Response } from "express";
import { supabase } from "../db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { data: loans, error } = await supabase
    .from("loans")
    .select(
      `
      id, principal_amount, installment_amount, num_installments, start_date, status,
      borrowers ( id, name, phone, bank_account_number, account_ref )
    `,
    )
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Disbursements error:", error);
    return res.status(500).json({ error: error.message });
  }
  return res.json(loans || []);
});

export default router;
