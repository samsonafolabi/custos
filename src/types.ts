export interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant: {
      userId: string;
      walletId: string;
    };
    transaction: {
      transactionId: string;
      type: string;
      time: string;
      responseCode?: string;
      aliasAccountReference?: string; // the account_ref
      transactionAmount?: number; // real field name; Nomba sends this as a number, not a string
    };
    customer?: {
      senderName?: string;
    };
  };
}
