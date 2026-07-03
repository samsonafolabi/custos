import { supabase } from "./db";
import dotenv from "dotenv";
dotenv.config();

async function getLiveToken() {
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID; // your one general account ID
  const clientId = process.env.NOMBA_LIVE_CLIENT_ID;
  const privateKey = process.env.NOMBA_LIVE_PRIVATE_KEY;

  const response = await fetch("https://api.nomba.com/v1/auth/token/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId: accountId as string,
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: privateKey,
    }),
  });

  const data = await response.json();
  if (data.code === "00" && data.data?.access_token) {
    return data.data.access_token;
  }
  throw new Error(
    "Live auth failed: " + (data.description || JSON.stringify(data)),
  );
}

async function createLiveVirtualAccount(
  accountRef: string,
  accountName: string,
) {
  const token = await getLiveToken();
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
  const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID; // your sub-account ID

  const payload: any = {
    accountRef,
    accountName,
    currency: "NGN",
  };

  // If Nomba requires sub-account scoping, uncomment below:
  // payload.subAccountId = subAccountId;

  const res = await fetch("https://api.nomba.com/v1/accounts/virtual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      accountId: accountId as string,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Live create response:", JSON.stringify(data, null, 2));

  if (data.code === "00" && data.data?.bankAccountNumber) {
    console.log("✅ LIVE account created:", data.data.bankAccountNumber);
    return data.data;
  } else {
    console.error("❌ Live creation failed:", data.description || data.message);
    return null;
  }
}

async function saveToDb(accountRef: string, accountData: any) {
  const { data: lender } = await supabase
    .from("lenders")
    .select("id")
    .eq("nomba_account_id", "demo-account-1")
    .single();

  if (!lender) {
    console.error("❌ No lender found. Run seed.ts first.");
    return;
  }

  const { data: borrower, error } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: accountData.accountName.replace("Nomba/", ""), // strip prefix if present
      account_ref: accountRef,
      account_holder_id: accountData.accountHolderId,
      bank_account_number: accountData.bankAccountNumber,
      phone: "+2348000000000",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ DB insert failed:", error.message);
    return;
  }

  // Create a loan
  const { data: loan } = await supabase
    .from("loans")
    .insert({
      borrower_id: borrower.id,
      principal_amount: 60000,
      installment_amount: 10000,
      num_installments: 6,
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
    })
    .select()
    .single();

  if (loan) {
    for (let i = 1; i <= 6; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      await supabase.from("installments").insert({
        loan_id: loan.id,
        installment_number: i,
        amount_due: 10000,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
      });
    }
  }

  console.log("✅ Saved to DB:", borrower.id);
}

async function main() {
  const accountRef = "borrower-live-prod-001";
  const accountName = "Live Test Borrower";

  const result = await createLiveVirtualAccount(accountRef, accountName);

  if (result) {
    await saveToDb(accountRef, result);
  }
}

main();
