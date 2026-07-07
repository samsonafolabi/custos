import { Router, Request, Response } from "express";
import { supabase } from "../db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { data: installments, error } = await supabase
    .from("installments")
    .select(
      `
      id, installment_number, amount_due, due_date, status,
      loans (
        id, principal_amount, installment_amount,
        borrowers ( id, name, phone )
      )
    `,
    )
    .eq("status", "paid")
    .order("due_date", { ascending: false });

  if (error) {
    console.error("Completed error:", error);
    return res.status(500).json({ error: error.message });
  }

  // Also get fully paid loans (all installments cleared)
  const { data: loans } = await supabase
    .from("loans")
    .select(
      `
      id, principal_amount, installment_amount, num_installments, start_date, status,
      borrowers ( id, name, phone ),
      installments ( id, status )
    `,
    )
    .eq("status", "active");

  const clearedLoans = (loans || []).filter((l) => {
    const inst = l.installments || [];
    return inst.length > 0 && inst.every((i) => i.status === "paid");
  });

  return res.json({
    installments: installments || [],
    loans: clearedLoans,
  });
});

export default router;
