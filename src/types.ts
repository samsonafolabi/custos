export interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  fee?: number;
  sessionId?: string;
  data: {
    type?: string;
    aliasAccountReference?: string;
    aliasAccountType?: string;
    merchant: {
      userId?: string;
      walletId: string;
      transactionId: string;
      transactionAmount?: number;
      walletBalance?: number;
      aliasAccountName?: string;
      accountNumber?: string;
      narration?: string;
      time?: string;
      responseCode?: string;
    };
    customer?: {
      senderName?: string;
      bankCode?: string;
      bankName?: string;
      accountNumber?: string;
    };
  };
}
