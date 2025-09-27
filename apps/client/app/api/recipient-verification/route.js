import { NextResponse } from "next/server";
import { SelfBackendVerifier, AllIds, DefaultConfigStore } from "@selfxyz/core";

const SCOPE = process.env.NEXT_PUBLIC_SELF_SCOPE || "self-codedecoders";
// Use Self docs verify endpoint by default; this API route acts as your backend verifier
const VERIFY_ENDPOINT =
  process.env.SELF_BACKEND_VERIFY_ENDPOINT ||
  "https://ranaco.loca.lt/api/recipient-verification";
const MOCK_PASSPORT = false;
const USER_ID_TYPE = "uuid";

const verifier = new SelfBackendVerifier(
  SCOPE,
  VERIFY_ENDPOINT,
  MOCK_PASSPORT,
  AllIds,
  new DefaultConfigStore({
    excludedCountries: [],
    minimumAge: 0,
    ofac: false,
  }),
  USER_ID_TYPE
);

export async function POST(request) {
  try {
    const { attestationId, proof, publicSignals, userContextData } =
      await request.json();

    console.log("Received verification request:", {
      attestationId,
      proof,
      publicSignals,
      userContextData,
    });

    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason:
            "Proof, publicSignals, attestationId and userContextData are required",
        },
        { status: 200 }
      );
    }

    const result = await verifier.verify(
      attestationId,
      proof,
      publicSignals,
      userContextData
    );

    if (!result?.isValidDetails?.isValid) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Verification failed",
          details: result?.isValidDetails || null,
        },
        { status: 200 }
      );
    }

    const nationality = result?.discloseOutput?.nationality || null;
    if (!nationality) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Nationality was not disclosed",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        result: true,
        credentialSubject: result.discloseOutput,
        nationality,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    result: true,
    message: "Recipient verification endpoint is reachable",
    scope: SCOPE,
    endpoint: VERIFY_ENDPOINT,
    mockPassport: MOCK_PASSPORT,
    userIdType: USER_ID_TYPE,
  });
}
