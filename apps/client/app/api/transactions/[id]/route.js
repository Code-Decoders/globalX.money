import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  const { id } = await params || {};
  if (!id) {
    return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
  }

  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Failed to load transaction", error);
    return NextResponse.json({ error: "Unable to load transaction" }, { status: 500 });
  }
}
