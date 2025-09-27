import crypto from "crypto";

const GPS_API_KEY = process.env.GPS_API_KEY;
const GPS_API_SECRET = process.env.GPS_API_SECRET;
const GPS_BASE_URL = process.env.GPS_BASE_URL ?? "https://stg-global-payments.arpdigital.io/api/v1";
const GPS_SENDER_ID = process.env.GPS_SENDER_ID ?? "59e11c00-623b-4238-8b0e-c2192b6010c8";

const REQUIRED_ENV = [
  ["GPS_API_KEY", GPS_API_KEY],
  ["GPS_API_SECRET", GPS_API_SECRET],
];

export class GpsTransactionError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.name = "GpsTransactionError";
    this.status = status;
    this.details = details;
  }
}

const ensureEnv = () => {
  const missing = REQUIRED_ENV.filter(([, value]) => !value);
  if (missing.length) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new GpsTransactionError(`Missing required environment variables: ${keys}`, 500);
  }
};

const generateSignature = (requestBody, timestamp) => {
  const message = `${GPS_API_KEY}${requestBody}${timestamp}`;
  return crypto.createHmac("sha256", GPS_API_SECRET).update(message).digest("hex");
};

export async function executeGpsTransaction(payload) {
  ensureEnv();

  if (!payload || typeof payload !== "object") {
    throw new GpsTransactionError("Invalid transaction payload", 400);
  }

  const recipientId = payload.recipientId;
  if (!recipientId) {
    throw new GpsTransactionError("recipientId is required", 400);
  }

  let quoteId = payload.quoteId;
  let refreshedQuoteDetails;
  const fromAmount = payload.fromAmount;

  if (!quoteId) {
    if (!fromAmount) {
      throw new GpsTransactionError("fromAmount is required when quoteId is missing", 400);
    }

    const normalizedAmount = Number.parseFloat(String(fromAmount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new GpsTransactionError("fromAmount must be a positive number", 400);
    }

    const quotePayload = {
      fromCurrency: payload.fromCurrency || "USD",
      toCurrency: payload.toCurrency || "INR",
      fromAmount: normalizedAmount.toString(),
      recipientId,
      senderId: payload.senderId || GPS_SENDER_ID,
    };

    const quoteBodyString = JSON.stringify(quotePayload);
    const quoteTimestamp = Math.floor(Date.now() / 1000).toString();
    const quoteSignature = generateSignature(quoteBodyString, quoteTimestamp);

    const quoteResponse = await fetch(`${GPS_BASE_URL}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPS_API_KEY,
        "X-Timestamp": quoteTimestamp,
        "X-Signature": quoteSignature,
      },
      body: quoteBodyString,
    });

    const quoteData = await quoteResponse.json().catch(() => ({}));

    if (!quoteResponse.ok || !quoteData?.data?.id) {
      throw new GpsTransactionError(quoteData?.error || "Failed to refresh quote", quoteResponse.status || 502, quoteData);
    }

    quoteId = quoteData.data.id;
    refreshedQuoteDetails = quoteData.data;
  }

  const transactionPayload = {
    quoteId,
    recipientId,
    senderId: payload.senderId || GPS_SENDER_ID,
    notes: payload.notes ?? "",
    purposeOfPayment: payload.purposeOfPayment ?? "",
  };

  if (!transactionPayload.purposeOfPayment) {
    throw new GpsTransactionError("purposeOfPayment is required", 400);
  }

  const bodyString = JSON.stringify(transactionPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(bodyString, timestamp);

  const response = await fetch(`${GPS_BASE_URL}/transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": GPS_API_KEY,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body: bodyString,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new GpsTransactionError(data?.error || data?.message || "Failed to execute transaction", response.status, data);
  }

  return refreshedQuoteDetails ? { ...data, quote: refreshedQuoteDetails } : data;
}

export const gpsDefaults = {
  senderId: GPS_SENDER_ID,
  baseUrl: GPS_BASE_URL,
};
