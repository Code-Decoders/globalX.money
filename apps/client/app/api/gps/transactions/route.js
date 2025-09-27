import { NextResponse } from "next/server";

import { executeGpsTransaction, GpsTransactionError } from "./service";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const result = await executeGpsTransaction(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GpsTransactionError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }

    return NextResponse.json({ error: error.message || "Unknown GPS error" }, { status: 500 });
  }
}
