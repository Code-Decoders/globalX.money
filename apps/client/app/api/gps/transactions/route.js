import crypto from "crypto";
import { NextResponse } from "next/server";

const GPS_API_KEY = process.env.GPS_API_KEY;
const GPS_API_SECRET = process.env.GPS_API_SECRET;
const GPS_BASE_URL = process.env.GPS_BASE_URL ?? "https://stg-global-payments.arpdigital.io/api/v1";
const GPS_SENDER_ID = process.env.GPS_SENDER_ID ?? "59e11c00-623b-4238-8b0e-c2192b6010c8";

const REQUIRED_ENV = [
  ["GPS_API_KEY", GPS_API_KEY],
  ["GPS_API_SECRET", GPS_API_SECRET],
];

const ensureEnv = () => {
  const missing = REQUIRED_ENV.filter(([, value]) => !value);
  if (missing.length) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new Error(`Missing required environment variables: ${keys}`);
  }
};

const generateSignature = (requestBody, timestamp) => {
  const message = `${GPS_API_KEY}${requestBody}${timestamp}`;
  return crypto.createHmac("sha256", GPS_API_SECRET).update(message).digest("hex");
};

export async function POST(request) {
  try {
    ensureEnv();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const recipientId = payload?.recipientId;
  if (!recipientId) {
    return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
  }

  let quoteId = payload?.quoteId;
  let refreshedQuoteDetails;
  const fromAmount = payload?.fromAmount;

  if (!quoteId) {
    if (!fromAmount) {
      return NextResponse.json({ error: "fromAmount is required when quoteId is missing" }, { status: 400 });
    }

    const normalizedAmount = Number.parseFloat(String(fromAmount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return NextResponse.json({ error: "fromAmount must be a positive number" }, { status: 400 });
    }

    const quotePayload = {
      fromCurrency: "USD",
      toCurrency: "INR",
      fromAmount: normalizedAmount.toString(),
      recipientId,
      senderId: payload?.senderId || GPS_SENDER_ID,
    };

    const quoteBodyString = JSON.stringify(quotePayload);
    const quoteTimestamp = Math.floor(Date.now() / 1000).toString();
    const quoteSignature = generateSignature(quoteBodyString, quoteTimestamp);

    try {
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
        return NextResponse.json(
          {
            error: quoteData?.error || "Failed to refresh quote",
            details: quoteData,
          },
          { status: quoteResponse.status || 502 },
        );
      }

      quoteId = quoteData.data.id;
      refreshedQuoteDetails = quoteData.data;
    } catch (error) {
      return NextResponse.json({ error: error.message || "Unable to create quote" }, { status: 502 });
    }
  }

  const transactionPayload = {
    quoteId,
    recipientId,
    senderId: payload?.senderId || GPS_SENDER_ID,
    notes: payload?.notes ?? "",
    purposeOfPayment: payload?.purposeOfPayment ?? "",
  };

  if (!transactionPayload.purposeOfPayment) {
    return NextResponse.json({ error: "purposeOfPayment is required" }, { status: 400 });
  }

  const bodyString = JSON.stringify(transactionPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(bodyString, timestamp);

  try {
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
      return NextResponse.json(
        {
          error: data?.error || data?.message || "Failed to execute transaction",
          details: data,
        },
        { status: response.status },
      );
    }

    const result = refreshedQuoteDetails ? { ...data, quote: refreshedQuoteDetails } : data;

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown GPS error" }, { status: 500 });
  }
}
