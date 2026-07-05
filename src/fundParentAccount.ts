// fundParentAccount.ts
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function getToken() {
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
  const clientId = process.env.NOMBA_LIVE_CLIENT_ID;
  const privateKey = process.env.NOMBA_LIVE_PRIVATE_KEY;

  const res = await fetch("https://api.nomba.com/v1/auth/token/issue", {
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

  const data = await res.json();
  if (data.code !== "00" || !data.data?.access_token) {
    throw new Error(
      "Auth failed: " + (data.description || JSON.stringify(data)),
    );
  }
  return data.data.access_token;
}

async function createParentVA(accountRef: string, accountName: string) {
  const token = await getToken();
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;

  // NO subAccountId in URL — creates under parent account
  const res = await fetch("https://api.nomba.com/v1/accounts/virtual", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      accountId: accountId as string,
    },
    body: JSON.stringify({
      accountRef,
      accountName,
      currency: "NGN",
    }),
  });

  const data = await res.json();
  console.log("VA response:", JSON.stringify(data, null, 2));

  if (data.code === "00" && data.data?.bankAccountNumber) {
    return data.data.bankAccountNumber;
  }
  throw new Error(data.description || "VA creation failed");
}

async function main() {
  const accountNumber = await createParentVA(
    "fund-parent-" + Date.now(),
    "Custos Funding",
  );

  console.log("\n=== FUND THIS ACCOUNT ===");
  console.log("Bank: Nombank MFB");
  console.log("Account Number:", accountNumber);
  console.log("\nMoney will hit your PRIMARY account balance");
  console.log("Current primary balance: ₦78.97");
  console.log("Delete this script after funding.");
}

main().catch(console.error);
