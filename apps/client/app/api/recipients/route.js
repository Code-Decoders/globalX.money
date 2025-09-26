import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const normalizeAddress = (value) => value?.toLowerCase();

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
    const body = await request.json();

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

    const recipient = await prisma.recipient.create({ data: payload });

    return NextResponse.json({ recipient }, { status: 201 });
  } catch (error) {
    console.error("Failed to save recipient", error);
    return NextResponse.json({ error: "Unable to save recipient" }, { status: 500 });
  }
}
