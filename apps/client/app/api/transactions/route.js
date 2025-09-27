import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const DEFAULT_CLAIM_WINDOW_MINUTES = 60;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const {
    senderWallet,
    recipientId,
    recipientEmail,
    recipientPhone,
    fromAmount,
    purposeOfPayment,
    notes,
    currencyFrom = "USD",
    currencyTo = "INR",
    quoteId,
    quoteSnapshot,
    quoteExpiresAt,
    claimBaseUrl,
  } = body ?? {};

  if (!senderWallet) {
    return NextResponse.json({ error: "senderWallet is required" }, { status: 400 });
  }

  if (!recipientId && !recipientEmail && !recipientPhone) {
    return NextResponse.json({ error: "Provide recipientId or recipient contact details" }, { status: 400 });
  }

  if (!fromAmount) {
    return NextResponse.json({ error: "fromAmount is required" }, { status: 400 });
  }

  const amountNumeric = Number.parseFloat(String(fromAmount));
  if (!Number.isFinite(amountNumeric) || amountNumeric <= 0) {
    return NextResponse.json({ error: "fromAmount must be a positive number" }, { status: 400 });
  }

  if (!purposeOfPayment || !String(purposeOfPayment).trim()) {
    return NextResponse.json({ error: "purposeOfPayment is required" }, { status: 400 });
  }

  const parsedQuoteExpiresAt = (() => {
    if (quoteExpiresAt) {
      const date = new Date(quoteExpiresAt);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  })();

  const claimExpiresAt = parsedQuoteExpiresAt ?? new Date(Date.now() + DEFAULT_CLAIM_WINDOW_MINUTES * 60 * 1000);

  try {
    const transaction = await prisma.transaction.create({
      data: {
        senderWallet,
        recipientId: recipientId ?? null,
        recipientEmail: recipientEmail ?? null,
        recipientPhone: recipientPhone ?? null,
        fromAmount: new Prisma.Decimal(amountNumeric.toFixed(2)),
        currencyFrom,
        currencyTo,
        purpose: String(purposeOfPayment).trim(),
        notes: notes ? String(notes).trim() : null,
        quoteId: quoteId ?? null,
        quoteSnapshot: quoteSnapshot ?? null,
        quoteExpiresAt: parsedQuoteExpiresAt,
        claimExpiresAt,
      },
    });

    const claimPath = `/claim/${transaction.id}`;
    const claimUrl = claimBaseUrl ? `${claimBaseUrl.replace(/\/$/, "")}${claimPath}` : claimPath;

    console.info(
      `[Notification] Send claim link ${claimUrl} to recipient ${recipientId ?? recipientEmail ?? recipientPhone ?? "unknown"}.`,
    );

    return NextResponse.json({ transaction, claimUrl }, { status: 201 });
  } catch (error) {
    console.error("Failed to create transaction request", error);
    return NextResponse.json({ error: "Unable to create transaction request" }, { status: 500 });
  }
}
