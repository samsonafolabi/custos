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
  console.log("Auth response:", JSON.stringify(data, null, 2));

  if (data.code !== "00" || !data.data?.access_token) {
    throw new Error(
      "Auth failed: " + (data.description || JSON.stringify(data)),
    );
  }

  return data.data.access_token;
}

async function main() {
  const token = await getToken();
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
  const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID;

  // Parent account balance
  const parentRes = await fetch("https://api.nomba.com/v1/accounts/balance", {
    headers: {
      Authorization: `Bearer ${token}`,
      accountId: accountId as string,
    },
  });
  const parentData = await parentRes.json();
  console.log("=== Parent Account Balance ===");
  console.log(JSON.stringify(parentData, null, 2));

  // Sub-account balance
  const subRes = await fetch(
    `https://api.nomba.com/v1/accounts/${subAccountId}/balance`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: accountId as string,
      },
    },
  );
  const subData = await subRes.json();
  console.log("\n=== Sub-Account Balance ===");
  console.log(JSON.stringify(subData, null, 2));

  // Also check virtual account list
  const vaRes = await fetch("https://api.nomba.com/v1/accounts/virtual/list", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      accountId: accountId as string,
    },
    body: JSON.stringify({}),
  });
  const vaData = await vaRes.json();
  console.log("\n=== Virtual Accounts ===");
  console.log(JSON.stringify(vaData, null, 2));
}

main().catch(console.error);
