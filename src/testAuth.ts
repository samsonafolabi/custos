import dotenv from "dotenv";
dotenv.config();

async function testAuth() {
  const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
  const clientId = process.env.NOMBA_TEST_CLIENT_ID;
  const privateKey = process.env.NOMBA_TEST_PRIVATE_KEY;

  console.log("Using accountId:", accountId);
  console.log("Using clientId:", clientId);

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
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

testAuth();
