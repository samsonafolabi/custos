import crypto from "crypto";

import { NombaWebhookPayload } from "./types";

export function verifyNombaSignature(
  payload: NombaWebhookPayload,
  receivedSignature: string,
  timestamp: string,
  secret: string,
): boolean {
  let responseCode = payload.data.transaction.responseCode || "";
  if (responseCode === "null") {
    responseCode = "";
  }

  const hashingPayload = [
    payload.event_type,
    payload.requestId,
    payload.data.merchant.userId,
    payload.data.merchant.walletId,
    payload.data.transaction.transactionId,
    payload.data.transaction.type,
    payload.data.transaction.time,
    responseCode,
    timestamp,
  ].join(":");

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(hashingPayload)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
