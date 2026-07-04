import dotenv from "dotenv";
dotenv.config();

const NOMBA_BASE = "https://api.nomba.com";
const MAIN_ACCOUNT_ID = process.env.NOMBA_MAIN_ACCOUNT_ID as string;
const SUB_ACCOUNT_ID = process.env.NOMBA_SUB_ACCOUNT_ID as string;

// ─── Auth ───
export async function getNombaToken(
  mode: "live" | "test" = "live",
): Promise<string> {
  const clientId =
    mode === "live"
      ? process.env.NOMBA_LIVE_CLIENT_ID
      : process.env.NOMBA_TEST_CLIENT_ID;
  const privateKey =
    mode === "live"
      ? process.env.NOMBA_LIVE_PRIVATE_KEY
      : process.env.NOMBA_TEST_PRIVATE_KEY;

  const res = await fetch(`${NOMBA_BASE}/v1/auth/token/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId: MAIN_ACCOUNT_ID,
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
      `Nomba auth failed: ${data.description || JSON.stringify(data)}`,
    );
  }
  return data.data.access_token;
}

// ─── Create Virtual Account ───
export async function createVirtualAccount(
  accountRef: string,
  accountName: string,
  token: string,
): Promise<{ bankAccountNumber: string; accountHolderId: string }> {
  const res = await fetch(
    `${NOMBA_BASE}/v1/accounts/virtual/${SUB_ACCOUNT_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        accountId: MAIN_ACCOUNT_ID,
      },
      body: JSON.stringify({
        accountRef,
        accountName,
        currency: "NGN",
      }),
    },
  );

  const data = await res.json();
  if (data.code !== "00" || !data.data?.bankAccountNumber) {
    throw new Error(data.description || "Virtual account creation failed");
  }

  return {
    bankAccountNumber: data.data.bankAccountNumber,
    accountHolderId: data.data.accountHolderId,
  };
}

// ─── Disburse Loan ───
export async function disburseLoan(params: {
  amount: number;
  transferRef: string;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankCode: string;
  recipientBankName?: string;
  narration: string;
  token: string;
}): Promise<{ status: string; transferRef: string }> {
  // Use parent account endpoint — no subAccountId in URL
  const res = await fetch(`${NOMBA_BASE}/v2/transfers/bank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
      accountId: MAIN_ACCOUNT_ID,
    },
    body: JSON.stringify({
      amount: params.amount,
      merchantTxRef: params.transferRef,
      senderName: "Custos Lending",
      accountNumber: params.recipientAccountNumber, // ← correct field name
      bankCode: params.recipientBankCode, // ← correct field name
      accountName: params.recipientName, // ← correct field name
      narration: params.narration,
    }),
  });

  const data = await res.json();
  console.log("Disbursement response:", JSON.stringify(data, null, 2));

  if (data.code !== "00") {
    throw new Error(data.description || "Loan disbursement failed");
  }

  return {
    status: data.data?.status || "initiated",
    transferRef: params.transferRef,
  };
}
