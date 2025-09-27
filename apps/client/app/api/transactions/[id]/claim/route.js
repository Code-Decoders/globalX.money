import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { executeGpsTransaction } from "@/app/api/gps/transactions/service";

const markExpired = async (id) => {
  try {
    await prisma.transaction.update({ where: { id }, data: { status: "EXPIRED" } });
  } catch (error) {
    console.error("Failed to mark transaction expired", error);
  }
};

export async function POST(request, { params }) {
  const { id } = await params || {};
  if (!id) {
    return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action.toLowerCase() : "claim";

  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status !== "PENDING") {
      return NextResponse.json({ error: "Transaction is not pending claim" }, { status: 400 });
    }

    if (transaction.claimExpiresAt && transaction.claimExpiresAt.getTime() < Date.now()) {
      await markExpired(id);
      return NextResponse.json({ error: "Transaction request has expired" }, { status: 400 });
    }

    const recipientId = body.recipientId ?? transaction.recipientId;
    if (!recipientId) {
      return NextResponse.json({ error: "recipientId is required to claim" }, { status: 400 });
    }

    const baseUpdate = {
      recipientId,
      gpsTransactionId: null,
      gpsResponse: null,
    };

    if (action === "hold") {
      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          ...baseUpdate,
          status: "CLAIMED",
          claimedAt: new Date(),
        },
      });

      return NextResponse.json({
        transaction: updated,
        message: "Funds placed on hold. Earn 4% interest while you decide next steps.",
      });
    }


    const result = await executeGpsTransaction({
      recipientId: recipientId,
      quoteId: transaction.quoteId,
      fromAmount: transaction.fromAmount,
      fromCurrency: transaction.fromCurrency,
      toCurrency: transaction.toCurrency,
      notes: transaction.notes,
      purposeOfPayment: transaction.purpose,

    });

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...baseUpdate,
        status: "CLAIMED",
        claimedAt: new Date(),
      },
    });

    return NextResponse.json({
      transaction: updated,
      message: "Funds claimed. We'll notify you when they're ready to release.",
    });
  } catch (error) {
    if (error instanceof GpsTransactionError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error("Failed to process transaction claim", error);
    return NextResponse.json({ error: "Unable to update transaction" }, { status: 500 });
  }
}
