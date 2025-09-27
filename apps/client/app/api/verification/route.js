import { NextResponse } from "next/server";
import { ethers } from "ethers";

const normalize = (v) => v?.toLowerCase();

// CentralWallet contract ABI (only the methods we need)
const CENTRAL_WALLET_ABI = [
  "function isHumanVerified(address user) external view returns (bool)",
  "function setVerifiedHuman(address user, bool isVerified) external"
];

const CENTRAL_WALLET_ADDRESS = process.env.NEXT_PUBLIC_CENTRAL_WALLET_ADDRESS;
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC;

// Create provider for reading from Sepolia
const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    
    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    // Validate address format
    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
    }

    // Create contract instance
    const centralWalletContract = new ethers.Contract(
      CENTRAL_WALLET_ADDRESS,
      CENTRAL_WALLET_ABI,
      sepoliaProvider
    );

    // Read verification status from contract
    const isVerified = await centralWalletContract.isHumanVerified(walletAddress);
    
    return NextResponse.json({ verified: Boolean(isVerified) });
  } catch (error) {
    console.error("GET /api/verification failed", error);
    return NextResponse.json({ 
      error: "Unable to get verification status from contract",
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const walletAddress = body.walletAddress;
    const verified = Boolean(body.verified);

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    // Validate address format
    if (!ethers.isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
    }

    // Note: The POST method now only reads from the contract
    // The actual contract updates are handled by the relayer service
    // This endpoint can be used to verify current status after potential updates
    
    const centralWalletContract = new ethers.Contract(
      CENTRAL_WALLET_ADDRESS,
      CENTRAL_WALLET_ABI,
      sepoliaProvider
    );

    // Read current verification status from contract
    const isVerified = await centralWalletContract.isHumanVerified(walletAddress);
    
    return NextResponse.json({ 
      verified: Boolean(isVerified),
      message: "Verification status read from contract. Updates are handled by the relayer service."
    });
  } catch (error) {
    console.error("POST /api/verification failed", error);
    return NextResponse.json({ 
      error: "Unable to read verification status from contract",
      details: error.message 
    }, { status: 500 });
  }
}
