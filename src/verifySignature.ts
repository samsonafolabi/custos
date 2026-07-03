import crypto from "crypto";
import { NombaWebhookPayload } from "./types";

export function verifyNombaSignature(
  payload: NombaWebhookPayload | any, // accept any during debugging
  receivedSignature: string,
  timestamp: string,
  secret: string,
): boolean {
  if (!payload || typeof payload !== "object") {
    console.error(
      "verifyNombaSignature: payload is not an object, got:",
      typeof payload,
    );
    return false;
  }

  // Safely extract fields with fallbacks
  const eventType = payload?.event_type ?? "";
  const requestId = payload?.requestId ?? "";
  const userId = payload?.data?.merchant?.userId ?? "";
  const walletId = payload?.data?.merchant?.walletId ?? "";
  const transactionId = payload?.data?.transaction?.transactionId ?? "";
  const transactionType = payload?.data?.transaction?.type ?? "";
  const transactionTime = payload?.data?.transaction?.time ?? "";

  let responseCode = payload?.data?.transaction?.responseCode ?? "";
  if (responseCode === "null" || responseCode === null) {
    responseCode = "";
  }

  const hashingPayload = [
    eventType,
    requestId,
    userId,
    walletId,
    transactionId,
    transactionType,
    transactionTime,
    responseCode,
    timestamp,
  ].join(":");

  // Off by default — set DEBUG_WEBHOOK_VERBOSE=true temporarily if signatures
  // start mismatching and you need to see exactly what string was hashed.
  if (process.env.DEBUG_WEBHOOK_VERBOSE === "true") {
    console.log("Hashing payload:", hashingPayload);
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(hashingPayload)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    console.error(
      `Signature length mismatch. Expected: ${expectedBuffer.length}, Received: ${receivedBuffer.length}`,
    );
    return false;
  }

  const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  if (!isValid) {
    console.error("Signature verification failed for requestId:", requestId);
  }
  return isValid;
}
