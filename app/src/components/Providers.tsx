"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useAccount, useWalletClient } from "wagmi";

import { VaultClient } from "@/lib/client";
import { getEthersSigner } from "@/lib/client";
import { NETWORKS, DEFAULT_NETWORK, NetworkName, VAULT_ADDRESS, fluentTestnet } from "@/lib/constants";

/* ---------- Network context ---------- */

interface NetworkCtx {
  network: NetworkName;
  setNetwork: (n: NetworkName) => void;
}

const NetworkContext = createContext<NetworkCtx>({
  network: DEFAULT_NETWORK,
  setNetwork: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

/* ---------- Vault client context ---------- */

const VaultClientContext = createContext<VaultClient | null>(null);
export const useVaultClient = () => useContext(VaultClientContext);

/* ---------- VaultClient from wallet ---------- */

function VaultClientProvider({ children }: { children: ReactNode }) {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<VaultClient | null>(null);

  useEffect(() => {
    if (!walletClient || !VAULT_ADDRESS) {
      setClient(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const signer = await getEthersSigner(walletClient);
        if (!cancelled) {
          setClient(new VaultClient(VAULT_ADDRESS, signer));
        }
      } catch {
        if (!cancelled) setClient(null);
      }
    })();
    return () => { cancelled = true; };
  }, [walletClient]);

  return (
    <VaultClientContext.Provider value={client}>
      {children}
    </VaultClientContext.Provider>
  );
}

/* ---------- Wagmi / RainbowKit config ---------- */

const wagmiConfig = getDefaultConfig({
  appName: "Yumi Vaults",
  projectId: "00000000000000000000000000000000", // WalletConnect placeholder
  chains: [fluentTestnet],
  transports: {
    [fluentTestnet.id]: http("https://rpc.devnet.fluent.xyz/"),
  },
});

const queryClient = new QueryClient();

/* ---------- Root provider ---------- */

export default function Providers({ children }: { children: ReactNode }) {
  const [network, setNetworkRaw] = useState<NetworkName>(DEFAULT_NETWORK);
  const setNetwork = useCallback((n: NetworkName) => setNetworkRaw(n), []);

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: "#4f46e5" })}>
            <VaultClientProvider>{children}</VaultClientProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NetworkContext.Provider>
  );
}

/* Re-export wagmi hooks for convenience */
export { useAccount, useWalletClient };
