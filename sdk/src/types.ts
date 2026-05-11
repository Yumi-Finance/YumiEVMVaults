/** Parameters for initializing a new vault pool. */
export interface InitPoolParams {
  depositToken: string;
  aprBps: number;
  maturityTs: bigint;
  depositDeadlineOffset: bigint;
  minDepositAmount: bigint;
  maxTotalDeposit: bigint;
  whitelistEnabled: boolean;
}

/** Parameters for updating an existing pool. */
export interface UpdatePoolParams {
  updateMaxTotalDeposit: boolean;
  maxTotalDeposit: bigint;
  updateMinDepositAmount: boolean;
  minDepositAmount: bigint;
  updateAprBps: boolean;
  aprBps: number;
  updateAllowOverpay: boolean;
  allowOverpay: boolean;
}

/** On-chain pool data. */
export interface PoolData {
  poolId: bigint;
  depositToken: string;
  yieldToken: string;
  aprBps: number;
  maturityTs: bigint;
  depositDeadlineOffset: bigint;
  minDepositAmount: bigint;
  maxTotalDeposit: bigint;
  totalDeposited: bigint;
  totalExpectedReturn: bigint;
  totalRepaid: bigint;
  remainingRepay: bigint;
  totalAdminWithdrawn: bigint;
  totalSwept: bigint;
  withdrawalsEnabled: boolean;
  whitelistEnabled: boolean;
  allowOverpay: boolean;
  /** True after a successful `initPool` for this id. */
  initialized: boolean;
}

/** On-chain deposit permit data. */
export interface PermitData {
  maxAmount: bigint;
  amountUsed: bigint;
  expiresAt: bigint;
  exists: boolean;
}
