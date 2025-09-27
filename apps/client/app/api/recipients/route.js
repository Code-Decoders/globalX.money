import crypto from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const GPS_API_KEY = process.env.GPS_API_KEY;
const GPS_API_SECRET = process.env.GPS_API_SECRET;
const GPS_BASE_URL = process.env.GPS_BASE_URL ?? "https://stg-global-payments.arpdigital.io/api/v1";
const GPS_CLIENT_BASE_URL =
  process.env.GPS_CLIENT_BASE_URL ??
  (GPS_BASE_URL.endsWith("/api/v1") ? GPS_BASE_URL.replace(/\/api\/v1$/, "/api/client") : `${GPS_BASE_URL}/client`);
const GPS_SENDER_ID = process.env.GPS_SENDER_ID ?? "59e11c00-623b-4238-8b0e-c2192b6010c8";
const GPS_RECIPIENT_COUNTRY = process.env.GPS_RECIPIENT_COUNTRY ?? "IND";

const REQUIRED_ENV = [
  ["GPS_API_KEY", GPS_API_KEY],
  ["GPS_API_SECRET", GPS_API_SECRET],
];

const normalizeAddress = (value) => value?.toLowerCase();

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

const sanitize = (object) => {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ""));
};

const buildGpsPayload = (body) => {
  const type = body.type === "business" ? "BUSINESS" : "INDIVIDUAL";
  const verificationBase =
    type === "BUSINESS"
      ? {
          businessName: body.businessName,
          email: body.email,
          phone: body.phone,
        }
      : {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
        };

  const computedAccountHolder =
    body.accountHolder ||
    (type === "BUSINESS"
      ? body.businessName
      : [body.firstName, body.lastName].filter(Boolean).join(" ")) ||
    undefined;

  const bankMetadata = sanitize({
    accountNumber: body.accountNumber,
    ifscCode: body.ifsc,
    bankName: body.bankName,
    accountHolderName: computedAccountHolder,
    branch: body.branch,
    accountType: body.accountType ? String(body.accountType).toLowerCase() : undefined,
  });

  const bankDetails = sanitize({
    type: "BANK_ACCOUNT",
    metadata: bankMetadata,
  });

  const payload = {
    type,
    country: body.country || GPS_RECIPIENT_COUNTRY,
    senderId: GPS_SENDER_ID,
    verificationInfo: sanitize(verificationBase),
    paymentMethods: [bankDetails],
  };

  return payload;
};

const createGpsRecipient = async (body) => {
  ensureEnv();

  const gpsPayload = buildGpsPayload(body);
  const bodyString = JSON.stringify(gpsPayload);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(bodyString, timestamp);

  const response = await fetch(`${GPS_CLIENT_BASE_URL}/recipients`, {
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
    throw new Error(data?.error || data?.message || "Failed to create GPS recipient");
  }

  return data;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = normalizeAddress(searchParams.get("walletAddress"));

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress query param is required" }, { status: 400 });
  }

  try {
    const recipients = await prisma.recipient.findMany({
      where: { walletAddress },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error("Failed to fetch recipients", error);
    return NextResponse.json({ error: "Unable to load recipients" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    ensureEnv();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const walletAddress = normalizeAddress(body.walletAddress);
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const type = body.type === "business" ? "BUSINESS" : "INDIVIDUAL";
    const accountType = (body.accountType || "OTHER").toUpperCase();

    const payload = {
      walletAddress,
      type,
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      businessName: body.businessName || null,
      email: body.email || null,
      phone: body.phone || null,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      bankName: body.bankName,
      accountHolder: body.accountHolder,
      branch: body.branch || null,
      accountType,
    };

    const requiredFields = ["accountNumber", "ifsc", "bankName", "accountHolder"];
    for (const field of requiredFields) {
      if (!payload[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (type === "INDIVIDUAL" && !payload.firstName && !payload.lastName) {
      return NextResponse.json({ error: "firstName or lastName is required for individuals" }, { status: 400 });
    }

    if (type === "BUSINESS" && !payload.businessName) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    let gpsResponse;
    try {
      gpsResponse = await createGpsRecipient(body);
    } catch (error) {
      console.error("Failed to register GPS recipient", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to register recipient" }, { status: 502 });
    }

    const gpsRecipient = gpsResponse?.data ?? gpsResponse;
    const gpsRecipientId = gpsRecipient?.id;

    const dbPayload = { ...payload };
    if (gpsRecipientId) {
      dbPayload.id = gpsRecipientId;
    }

    const recipient = await prisma.recipient.create({ data: dbPayload });

    return NextResponse.json({ recipient, gpsRecipient }, { status: 201 });
  } catch (error) {
    console.error("Failed to save recipient", error);
    return NextResponse.json({ error: "Unable to save recipient" }, { status: 500 });
  }
}
