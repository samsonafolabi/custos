import dotenv from "dotenv";
dotenv.config();

async function getAccessToken(): Promise<string> {
  const response = await fetch("https://api.nomba.com/v1/auth/token/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId: process.env.NOMBA_MAIN_ACCOUNT_ID as string,
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.NOMBA_TEST_CLIENT_ID,
      client_secret: process.env.NOMBA_TEST_PRIVATE_KEY,
    }),
  });
  const result = await response.json();
  return result.data.access_token;
}

async function listVirtualAccounts() {
  const token = await getAccessToken();

  const response = await fetch(
    "https://sandbox.nomba.com/v1/accounts/virtual/list",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        accountId: process.env.NOMBA_MAIN_ACCOUNT_ID as string,
      },
      body: JSON.stringify({}),
    },
  );

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

listVirtualAccounts();
