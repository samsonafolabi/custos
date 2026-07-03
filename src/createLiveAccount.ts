import { supabase } from "./db";
import dotenv from "dotenv";
dotenv.config();

async function getLiveToken() {
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
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
  const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID;

  if (!subAccountId) {
    throw new Error(
      "NOMBA_SUB_ACCOUNT_ID is not set — required in the URL path for webhooks to fire on this account.",
    );
  }

  const payload = {
    accountRef,
    accountName,
    currency: "NGN",
  };

  const res = await fetch(
    `https://api.nomba.com/v1/accounts/virtual/${subAccountId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        accountId: accountId as string,
      },
      body: JSON.stringify(payload),
    },
  );

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

async function saveToDb(
  accountRef: string,
  accountName: string, // ← use the name YOU sent, not what Nomba returns
  phone: string, // ← pass real phone instead of hardcoding
  accountData: any,
) {
  const { data: lender } = await supabase
    .from("lenders")
    .select("id")
    .eq("nomba_account_id", "demo-account-1")
    .single();

  if (!lender) {
    console.error("❌ No lender found. Run seed.ts first.");
    return;
  }

  // Safety: if Nomba mutates the name, strip common prefixes, but prefer the original
  const cleanName =
    accountName
      .replace(/^Nomba\s*/i, "") // strips "Nomba " or "Nomba/" at start
      .replace(/^Hackathon\s*/i, "")
      .trim() || accountName;

  const { data: borrower, error } = await supabase
    .from("borrowers")
    .insert({
      lender_id: lender.id,
      name: cleanName, // ← now uses YOUR input, cleaned
      account_ref: accountRef,
      account_holder_id: accountData.accountHolderId,
      bank_account_number: accountData.bankAccountNumber,
      phone: phone, // ← real phone passed in
    })
    .select()
    .single();

  if (error) {
    console.error("❌ DB insert failed:", error.message);
    return;
  }

  // Create a loan
  const principal = 1200;
  const numInstallments = 6;
  const installmentAmount = Math.ceil(principal / numInstallments);

  const { data: loan } = await supabase
    .from("loans")
    .insert({
      borrower_id: borrower.id,
      principal_amount: principal,
      installment_amount: installmentAmount,
      num_installments: numInstallments,
      start_date: new Date().toISOString().split("T")[0],
      status: "active",
    })
    .select()
    .single();

  if (loan) {
    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      await supabase.from("installments").insert({
        loan_id: loan.id,
        installment_number: i,
        amount_due: installmentAmount,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
      });
    }
  }

  console.log("✅ Saved to DB:", borrower.id);
  console.log("   Name:", cleanName);
  console.log("   Phone:", phone);
  console.log("   Account:", accountData.bankAccountNumber);
}

async function main() {
  const accountRef = "borrower-live-prod-008";
  const accountName = "Seed Jigan Eleniyan";
  const phone = "+2348110813759"; // ← put the real phone here

  const result = await createLiveVirtualAccount(accountRef, accountName);

  if (result) {
    await saveToDb(accountRef, accountName, phone, result);
  }
}

main();
