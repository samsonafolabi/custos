import { supabase } from "./db";

async function seedLiveAccount() {
  // Find the lender first (from our earlier seed)
  const { data: lender } = await supabase
    .from("lenders")
    .select("id")
    .eq("nomba_account_id", "demo-account-1")
    .single();

  if (!lender) {
    console.error("❌ No lender found. Run seed.ts first.");
    process.exit(1);
  }

  // Insert the borrower with real Nomba account details
  const { data: borrower, error } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: "Test Borrower One",
      account_ref: "borrower-live-test-001",
      account_holder_id: "f666ef9b-888e-4799-85ce-acb505b28023",
      bank_account_number: "2213433541",
      phone: "+2348011111111",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Insert failed:", error.message);
    process.exit(1);
  }

  // Create a loan for this borrower
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      borrower_id: borrower.id,
      principal_amount: 60000,
      installment_amount: 10000,
      num_installments: 6,
      start_date: "2025-07-01",
      status: "active",
    })
    .select()
    .single();

  if (loanError) {
    console.error("❌ Loan insert failed:", loanError.message);
    process.exit(1);
  }

  // Create 6 installments
  for (let i = 1; i <= 6; i++) {
    const dueDate = new Date("2025-07-01");
    dueDate.setMonth(dueDate.getMonth() + i - 1);

    await supabase.from("installments").insert({
      loan_id: loan.id,
      installment_number: i,
      amount_due: 10000,
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  console.log("✅ Seeded live borrower with real Nomba account:");
  console.log("  Name: Test Borrower One");
  console.log("  Account ref: borrower-live-test-001");
  console.log("  Bank account: 2213433541");
  console.log("  Loan: ₦60,000, 6 installments of ₦10,000");
  process.exit(0);
}

seedLiveAccount();
