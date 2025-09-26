import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from "wagmi/chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not defined. RainbowKit will not be able to connect to wallets until it is set."
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "PY Remit",
  projectId: walletConnectProjectId ?? "00000000000000000000000000000000",
  chains: [mainnet, base, optimism, polygon, arbitrum, sepolia],
  ssr: true,
});
