import dotenv from "dotenv";
dotenv.config();

async function getNombaToken() {
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
  const clientId = process.env.NOMBA_TEST_CLIENT_ID;
  const privateKey = process.env.NOMBA_TEST_PRIVATE_KEY;

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
  throw new Error("Auth failed: " + (data.description || JSON.stringify(data)));
}

async function createVirtualAccount(accountRef: string, accountName: string) {
  const token = await getNombaToken();
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;

  const payload = { accountRef, accountName, currency: "NGN" };

  const res = await fetch("https://sandbox.nomba.com/v1/accounts/virtual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      accountId: accountId as string,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Create account response:", JSON.stringify(data, null, 2));

  if (data.code === "00" && data.data?.bankAccountNumber) {
    // ← FIXED
    console.log("✅ Created:", data.data.bankAccountNumber);
    return data.data;
  } else {
    console.error("❌ Failed:", data.description || data.message);
    return null;
  }
}

async function main() {
  const result = await createVirtualAccount(
    "borrower-live-test-001",
    "Test Borrower One",
  );

  if (result) {
    console.log("✅ SAVE THIS TO YOUR DATABASE:", {
      account_ref: "borrower-live-test-001",
      account_holder_id: result.accountHolderId,
      bank_account_number: result.bankAccountNumber,
    });
  }
}

main();
