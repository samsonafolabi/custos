import { Router, Request, Response } from "express";
import { supabase } from "../db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const today = new Date().toISOString().split("T")[0];

  const { data: overdue, error } = await supabase
    .from("installments")
    .select(
      `
      id, installment_number, amount_due, due_date, status,
      loans (
        id,
        borrowers ( id, name, phone )
      )
    `,
    )
    .in("status", ["pending", "partial"])
    .lt("due_date", today)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Aging error:", error);
    return res.status(500).json({ error: "Failed to fetch aging" });
  }
  return res.json(overdue);
});

export default router;
