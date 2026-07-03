import { supabase } from "./db";

async function seed() {
  // Create lender
  const { data: lender } = await supabase
    .from("lenders")
    .insert({ name: "Seed Microfinance", nomba_account_id: "demo-account-1" })
    .select()
    .single();

  if (!lender) throw new Error("Failed to create lender");

  // Create borrower
  const { data: borrower } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: "Chidinma Okafor",
      account_ref: "borrower-001",
      phone: "+2348012345678",
    })
    .select()
    .single();

  if (!borrower) throw new Error("Failed to create borrower");

  // Create loan
  const { data: loan } = await supabase
    .from("loans")
    .insert({
      borrower_id: borrower.id,
      principal_amount: 60000,
      installment_amount: 10000,
      num_installments: 6,
      start_date: "2026-06-01",
      status: "active",
    })
    .select()
    .single();

  if (!loan) throw new Error("Failed to create loan");

  // Create installments
  for (let i = 1; i <= 6; i++) {
    const dueDate = new Date("2025-06-01");
    dueDate.setMonth(dueDate.getMonth() + i - 1);

    await supabase.from("installments").insert({
      loan_id: loan.id,
      installment_number: i,
      amount_due: 10000,
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  console.log("✅ Seeded: 1 lender, 1 borrower, 1 loan, 6 installments");
  process.exit(0);
}

seed();
