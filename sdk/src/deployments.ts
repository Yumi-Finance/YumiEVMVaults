/** Known FixedVault deployment addresses keyed by EVM chain ID. */
export const DEPLOYMENTS: Record<number, string> = {
  20994: "0xd0B169e7b8e5672109628b71F213a5416A970498", // Fluent Testnet
  // 25363 (Fluent Mainnet): add vault address here after deploy, or set `NEXT_PUBLIC_VAULT_ADDRESS` in the app.
};
