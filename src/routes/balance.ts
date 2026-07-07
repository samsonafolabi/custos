import { Router, Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

async function getNombaToken(): Promise<string> {
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
  console.log("Nomba auth response:", JSON.stringify(data, null, 2));

  if (data.code !== "00" || !data.data?.access_token) {
    throw new Error(
      "Auth failed: " + (data.description || JSON.stringify(data)),
    );
  }
  return data.data.access_token;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const token = await getNombaToken();
    const accountId = process.env.NOMBA_MAIN_ACCOUNT_ID;
    const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID;

    // Parent balance
    const parentRes = await fetch("https://api.nomba.com/v1/accounts/balance", {
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: accountId as string,
      },
    });
    const parentData = await parentRes.json();
    console.log("Parent balance raw:", JSON.stringify(parentData, null, 2));

    // Sub-account balance (collections)
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
    console.log("Sub balance raw:", JSON.stringify(subData, null, 2));

    // Extract balances safely
    const parentBal =
      parentData.data?.availableBalance ??
      parentData.data?.ledgerBalance ??
      parentData.availableBalance ??
      parentData.ledgerBalance ??
      0;
    const subBal =
      subData.data?.availableBalance ??
      subData.data?.ledgerBalance ??
      subData.availableBalance ??
      subData.ledgerBalance ??
      0;

    return res.json({
      parent: { availableBalance: parentBal },
      sub: { availableBalance: subBal },
      raw: { parent: parentData, sub: subData },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Balance fetch error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch balance",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
