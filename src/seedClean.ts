import { supabase } from "./db";

function assertData<T>(data: T | null, label: string): T {
  if (!data) throw new Error(`Failed to get ${label}`);
  return data;
}

async function seedClean() {
  // Create lender
  const { data: lenderData } = await supabase
    .from("lenders")
    .insert({ name: "Lagos Capital", nomba_account_id: "demo-account-1" })
    .select()
    .single();
  const lender = assertData(lenderData, "lender");

  // Borrower 1: Has real virtual account
  const { data: b1Data } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: "Chidinma Okafor",
      account_ref: "borrower-001",
      account_holder_id: "f666ef9b-888e-4799-85ce-acb505b28023",
      bank_account_number: "8727351894",
      phone: "+2348012345678",
    })
    .select()
    .single();
  const b1 = assertData(b1Data, "borrower 1");

  // Borrower 2: All pending
  const { data: b2Data } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: "Emeka Nwosu",
      account_ref: "borrower-002",
      phone: "+2348023456789",
    })
    .select()
    .single();
  const b2 = assertData(b2Data, "borrower 2");

  // Borrower 3: Has overdue
  const { data: b3Data } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: "Amina Bello",
      account_ref: "borrower-003",
      phone: "+2348034567890",
    })
    .select()
    .single();
  const b3 = assertData(b3Data, "borrower 3");

  // Create loans
  const { data: loan1Data } = await supabase
    .from("loans")
    .insert({
      borrower_id: b1.id,
      principal_amount: 60000,
      installment_amount: 10000,
      num_installments: 6,
      start_date: "2026-07-01",
      status: "active",
    })
    .select()
    .single();
  const loan1 = assertData(loan1Data, "loan 1");

  const { data: loan2Data } = await supabase
    .from("loans")
    .insert({
      borrower_id: b2.id,
      principal_amount: 50000,
      installment_amount: 10000,
      num_installments: 5,
      start_date: "2026-06-01",
      status: "active",
    })
    .select()
    .single();
  const loan2 = assertData(loan2Data, "loan 2");

  const { data: loan3Data } = await supabase
    .from("loans")
    .insert({
      borrower_id: b3.id,
      principal_amount: 40000,
      installment_amount: 10000,
      num_installments: 4,
      start_date: "2026-05-01",
      status: "active",
    })
    .select()
    .single();
  const loan3 = assertData(loan3Data, "loan 3");

  // Loan 1: 2 paid, 1 partial, 3 pending
  for (let i = 1; i <= 6; i++) {
    const dueDate = new Date("2026-07-01");
    dueDate.setMonth(dueDate.getMonth() + i - 1);
    let status = "pending";
    if (i === 1) status = "paid";
    if (i === 2) status = "paid";
    if (i === 3) status = "partial";
    await supabase.from("installments").insert({
      loan_id: loan1.id,
      installment_number: i,
      amount_due: 10000,
      due_date: dueDate.toISOString().split("T")[0],
      status,
    });
  }

  // Loan 2: all pending
  for (let i = 1; i <= 5; i++) {
    const dueDate = new Date("2026-06-01");
    dueDate.setMonth(dueDate.getMonth() + i - 1);
    await supabase.from("installments").insert({
      loan_id: loan2.id,
      installment_number: i,
      amount_due: 10000,
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  // Loan 3: 2 paid, 1 overdue, 1 pending
  for (let i = 1; i <= 4; i++) {
    const dueDate = new Date("2026-05-01");
    dueDate.setMonth(dueDate.getMonth() + i - 1);
    let status = "pending";
    if (i === 1) status = "paid";
    if (i === 2) status = "paid";
    if (i === 3) status = "overdue";
    await supabase.from("installments").insert({
      loan_id: loan3.id,
      installment_number: i,
      amount_due: 10000,
      due_date: dueDate.toISOString().split("T")[0],
      status,
    });
  }

  // Create dispute for partial payment
  const { data: partialInstData } = await supabase
    .from("installments")
    .select("id")
    .eq("loan_id", loan1.id)
    .eq("installment_number", 3)
    .single();
  const partialInst = assertData(partialInstData, "partial installment");

  const { data: paymentData } = await supabase
    .from("payments")
    .insert({
      installment_id: partialInst.id,
      borrower_id: b1.id,
      amount_received: 5000,
      sender_name_raw: "Chidinma Okafor",
      nomba_transaction_id: "demo-tx-001",
      status: "pending",
      received_at: new Date().toISOString(),
    })
    .select()
    .single();
  const payment = assertData(paymentData, "payment");

  await supabase.from("disputes").insert({
    payment_id: payment.id,
    borrower_id: b1.id,
    type: "partial",
    suggested_borrower_id: b1.id,
    confidence_score: 85,
    reasoning:
      "Sender name matches borrower. Amount is ₦5,000 — exactly half of expected ₦10,000. Likely intentional partial payment.",
    recommended_action: "claim",
    merchant_tx_ref: "dispute-demo-001",
    status: "open",
  });

  console.log("✅ Clean seed complete");
  process.exit(0);
}

seedClean().catch((err) => {
  console.error(err);
  process.exit(1);
});
