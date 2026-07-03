import { handleNombaWebhook } from "./webhookHandler";
import { NombaWebhookPayload } from "./types";

const mockPayload: NombaWebhookPayload = {
  event_type: "transaction.successful",
  requestId: `mock-${Date.now()}`,
  data: {
    merchant: {
      userId: "test-merchant",
      walletId: "test-wallet",
    },
    transaction: {
      transactionId: `tx-${Date.now()}`,
      type: "credit",
      time: new Date().toISOString(),
      responseCode: "00",
      aliasAccountReference: "borrower-001", // must match a seeded borrower
      amount: "2000.00",
    },
    customer: {
      senderName: "Afolabi Samson",
    },
  },
};

async function run() {
  const result = await handleNombaWebhook(mockPayload);
  console.log("Result:", result);
  process.exit(0);
}

run();
