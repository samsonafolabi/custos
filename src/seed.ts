import { supabase } from "./db";

async function seed() {
  const { data: lender, error } = await supabase
    .from("lenders")
    .insert({ name: "Seed Microfinance", nomba_account_id: "demo-account-1" })
    .select()
    .single();

  if (error) {
    console.error("Failed to create lender:", error.message);
    process.exit(1);
  }

  if (!lender) {
    console.error("Lender creation returned null");
    process.exit(1);
  }

  console.log("✅ Seeded lender:", lender.id, lender.name);
  process.exit(0);
}

seed();
