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
      amount?: string; // Nomba sends amount as string
    };
    customer?: {
      senderName?: string;
    };
  };
}
