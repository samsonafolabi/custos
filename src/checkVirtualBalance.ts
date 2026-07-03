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
  throw new Error("Auth failed: " + (data.description || JSON.stringify(data)));
}

async function checkVirtualBalance(accountNumber: string) {
  const token = await getLiveToken();
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;

  const res = await fetch(
    `https://api.nomba.com/v1/accounts/virtual/${accountNumber}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: accountId as string,
      },
    },
  );

  const data = await res.json();
  console.log("Virtual account response:", JSON.stringify(data, null, 2));
}

checkVirtualBalance("8727351894");
