// Tests your /webhooks/nomba route end-to-end using a realistic Nomba
// payload shape, signed with YOUR real secret — no env var swapping.
// The HMAC logic itself was already proven correct against Nomba's
// documented known-answer vector (verify-known-answer.js), so this
// script just confirms your live route (header extraction, body
// parsing, secret lookup) works the same way.
//
// Usage:
//   NOMBA_WEBHOOK_SECRET=your_real_secret node test-webhook-known-answer.js
//   NOMBA_WEBHOOK_SECRET=your_real_secret node test-webhook-known-answer.js https://your-app.up.railway.app/webhooks/nomba

import crypto from "crypto";

const TARGET_URL = process.argv[2] || "http://localhost:3000/webhooks/nomba";
const SECRET = process.env.NOMBA_WEBHOOK_SECRET;

if (!SECRET) {
  console.error(
    "Set NOMBA_WEBHOOK_SECRET to your real secret before running this.",
  );
  process.exit(1);
}

const payload = {
  event_type: "payment_success",
  requestId: "45f2dc2d-d559-4773-bba3-2d5ec17b2e20",
  data: {
    merchant: {
      walletId: "6756ff80aafe04a795f18b38",
      walletBalance: 6052,
      userId: "b7b10e81-e57d-41d0-8fdc-f4e23a132bbf",
    },
    terminal: {},
    transaction: {
      aliasAccountNumber: "5343270516",
      fee: 5,
      sessionId: "IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bd5-fec9649e5928",
      type: "vact_transfer",
      transactionId: "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-9dbb4548fd7a",
      aliasAccountName: "ZAXBOX/EZENNA NWACHUKWU",
      responseCode: "",
      originatingFrom: "api",
      transactionAmount: 10,
      narration:
        "Habiblahi Hamzat Transfer 10.00 To ZAXBOX/EZENNA NWACHUKWU - Nomba",
      time: "2025-09-29T10:51:44Z",
      aliasAccountReference: "654f7c80bd4a510c90fb7f92",
      aliasAccountType: "VIRTUAL",
    },
    customer: {
      bankCode: "090645",
      senderName: "Habiblahi Hamzat",
      bankName: "Nombank",
      accountNumber: "9617811496",
    },
  },
};

// Use a fresh timestamp so this looks like a real live event, and update
// transaction.time to match (Nomba's real payloads have time == roughly now).
const timestamp = new Date().toISOString().split(".")[0] + "Z"; // RFC-3339, no ms
payload.data.transaction.time = timestamp;

// Sign it ourselves with the real secret — mirrors verifySignature.ts exactly.
const hashingPayload = [
  payload.event_type,
  payload.requestId,
  payload.data.merchant.userId,
  payload.data.merchant.walletId,
  payload.data.transaction.transactionId,
  payload.data.transaction.type,
  payload.data.transaction.time,
  payload.data.transaction.responseCode || "",
  timestamp,
].join(":");

const signature = crypto
  .createHmac("sha256", SECRET)
  .update(hashingPayload)
  .digest("base64");

async function main() {
  console.log(`POSTing payload to: ${TARGET_URL}`);
  console.log(`Using timestamp: ${timestamp}`);
  console.log(`Computed signature: ${signature}`);
  console.log("---");

  try {
    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "nomba-signature": signature,
        "nomba-timestamp": timestamp,
        "nomba-signature-algorithm": "HmacSHA256",
        "nomba-signature-version": "1.0.0",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log(`HTTP status: ${res.status}`);
    console.log(`Response body: ${text}`);
    console.log("---");
    console.log("Now check your server logs for:");
    console.log('  "Signature valid: true"');
    console.log("If you see that, your full route works end-to-end.");
    console.log('If you see "Missing headers" or "Invalid signature",');
    console.log("the bug is in header extraction or the secret env var,");
    console.log("not in the HMAC logic itself (already proven correct).");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Request failed:", message);
    console.error("Is your server actually running and reachable at that URL?");
  }
}

main();
