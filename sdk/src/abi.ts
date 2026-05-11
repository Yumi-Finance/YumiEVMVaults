export const FIXED_VAULT_ABI = [
  {
    "type": "constructor",
    "inputs": [{ "name": "authority_", "type": "address", "internalType": "address" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_APR_BPS",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint16", "internalType": "uint16" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SWEEP_GRACE_SECONDS",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptAuthority",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "adminWithdraw",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "amount", "type": "uint64", "internalType": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "authority",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "amount", "type": "uint64", "internalType": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableWithdrawals",
    "inputs": [{ "name": "poolId", "type": "uint64", "internalType": "uint64" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "grantPermit",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "user", "type": "address", "internalType": "address" },
      { "name": "maxAmount", "type": "uint64", "internalType": "uint64" },
      { "name": "expiresAt", "type": "int64", "internalType": "int64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initPool",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct FixedVault.InitPoolParams",
        "components": [
          { "name": "depositToken", "type": "address", "internalType": "address" },
          { "name": "aprBps", "type": "uint16", "internalType": "uint16" },
          { "name": "maturityTs", "type": "int64", "internalType": "int64" },
          { "name": "depositDeadlineOffset", "type": "uint64", "internalType": "uint64" },
          { "name": "minDepositAmount", "type": "uint64", "internalType": "uint64" },
          { "name": "maxTotalDeposit", "type": "uint64", "internalType": "uint64" },
          { "name": "whitelistEnabled", "type": "bool", "internalType": "bool" }
        ]
      }
    ],
    "outputs": [{ "name": "poolId", "type": "uint64", "internalType": "uint64" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pendingAuthority",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "permits",
    "inputs": [
      { "name": "", "type": "uint64", "internalType": "uint64" },
      { "name": "", "type": "address", "internalType": "address" }
    ],
    "outputs": [
      { "name": "maxAmount", "type": "uint64", "internalType": "uint64" },
      { "name": "amountUsed", "type": "uint64", "internalType": "uint64" },
      { "name": "expiresAt", "type": "int64", "internalType": "int64" },
      { "name": "exists", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextPoolId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint64", "internalType": "uint64" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pools",
    "inputs": [{ "name": "", "type": "uint64", "internalType": "uint64" }],
    "outputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "depositToken", "type": "address", "internalType": "address" },
      { "name": "yieldToken", "type": "address", "internalType": "address" },
      { "name": "aprBps", "type": "uint16", "internalType": "uint16" },
      { "name": "maturityTs", "type": "int64", "internalType": "int64" },
      { "name": "depositDeadlineOffset", "type": "uint64", "internalType": "uint64" },
      { "name": "minDepositAmount", "type": "uint64", "internalType": "uint64" },
      { "name": "maxTotalDeposit", "type": "uint64", "internalType": "uint64" },
      { "name": "totalDeposited", "type": "uint64", "internalType": "uint64" },
      { "name": "totalExpectedReturn", "type": "uint64", "internalType": "uint64" },
      { "name": "totalRepaid", "type": "uint64", "internalType": "uint64" },
      { "name": "remainingRepay", "type": "uint64", "internalType": "uint64" },
      { "name": "totalAdminWithdrawn", "type": "uint64", "internalType": "uint64" },
      { "name": "totalSwept", "type": "uint64", "internalType": "uint64" },
      { "name": "withdrawalsEnabled", "type": "bool", "internalType": "bool" },
      { "name": "whitelistEnabled", "type": "bool", "internalType": "bool" },
      { "name": "allowOverpay", "type": "bool", "internalType": "bool" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proposeAuthority",
    "inputs": [{ "name": "newAuthority", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "repay",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "amount", "type": "uint64", "internalType": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokePermit",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "user", "type": "address", "internalType": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sweepRepayVault",
    "inputs": [{ "name": "poolId", "type": "uint64", "internalType": "uint64" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updatePool",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct FixedVault.UpdatePoolParams",
        "components": [
          { "name": "updateMaxTotalDeposit", "type": "bool", "internalType": "bool" },
          { "name": "maxTotalDeposit", "type": "uint64", "internalType": "uint64" },
          { "name": "updateMinDepositAmount", "type": "bool", "internalType": "bool" },
          { "name": "minDepositAmount", "type": "uint64", "internalType": "uint64" },
          { "name": "updateAprBps", "type": "bool", "internalType": "bool" },
          { "name": "aprBps", "type": "uint16", "internalType": "uint16" },
          { "name": "updateAllowOverpay", "type": "bool", "internalType": "bool" },
          { "name": "allowOverpay", "type": "bool", "internalType": "bool" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      { "name": "poolId", "type": "uint64", "internalType": "uint64" },
      { "name": "amount", "type": "uint64", "internalType": "uint64" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AdminWithdrawEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "authority_", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "totalAdminWithdrawn", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AuthorityProposed",
    "inputs": [
      { "name": "current", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "proposed", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AuthorityTransferred",
    "inputs": [
      { "name": "previous", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newAuthority", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DepositEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "yTokensMinted", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "totalDeposited", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DepositPermitGranted",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "maxAmount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "expiresAt", "type": "int64", "indexed": false, "internalType": "int64" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DepositPermitRevoked",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EnableWithdrawalsEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "authority_", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "totalRepaid", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "totalExpectedReturn", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolInitialized",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "depositToken", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "yieldToken", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "aprBps", "type": "uint16", "indexed": false, "internalType": "uint16" },
      { "name": "maturityTs", "type": "int64", "indexed": false, "internalType": "int64" },
      { "name": "depositDeadlineOffset", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "minDepositAmount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "maxTotalDeposit", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "whitelistEnabled", "type": "bool", "indexed": false, "internalType": "bool" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolUpdated",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "authority_", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "maxTotalDeposit", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "minDepositAmount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "aprBps", "type": "uint16", "indexed": false, "internalType": "uint16" },
      { "name": "allowOverpay", "type": "bool", "indexed": false, "internalType": "bool" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepayEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "authority_", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "totalRepaid", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "remainingRepay", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SweepRepayVaultEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "authority_", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "amount", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "totalSwept", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WithdrawEvent",
    "inputs": [
      { "name": "poolId", "type": "uint64", "indexed": true, "internalType": "uint64" },
      { "name": "user", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "yTokensBurned", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "payout", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "remainingRepay", "type": "uint64", "indexed": false, "internalType": "uint64" },
      { "name": "ts", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  { "type": "error", "name": "AdminWithdrawExceeded", "inputs": [] },
  { "type": "error", "name": "AprTooHigh", "inputs": [] },
  { "type": "error", "name": "CannotRevokeOverpay", "inputs": [] },
  { "type": "error", "name": "CapBelowActive", "inputs": [] },
  { "type": "error", "name": "DecimalsTooHigh", "inputs": [] },
  { "type": "error", "name": "DepositDeadlinePassed", "inputs": [] },
  { "type": "error", "name": "DepositTooSmall", "inputs": [] },
  { "type": "error", "name": "InvalidDeadlineOffset", "inputs": [] },
  { "type": "error", "name": "InvalidMaturity", "inputs": [] },
  { "type": "error", "name": "MathOverflow", "inputs": [] },
  { "type": "error", "name": "MaturityNotReached", "inputs": [] },
  { "type": "error", "name": "NoPendingAuthority", "inputs": [] },
  { "type": "error", "name": "NoRepayRemaining", "inputs": [] },
  { "type": "error", "name": "NoRepayToDistribute", "inputs": [] },
  { "type": "error", "name": "NotWhitelisted", "inputs": [] },
  { "type": "error", "name": "NothingToSweep", "inputs": [] },
  { "type": "error", "name": "PermitExpired", "inputs": [] },
  { "type": "error", "name": "PermitLimitExceeded", "inputs": [] },
  { "type": "error", "name": "PoolAlreadyExists", "inputs": [] },
  { "type": "error", "name": "PoolCapExceeded", "inputs": [] },
  { "type": "error", "name": "PoolDoesNotExist", "inputs": [] },
  { "type": "error", "name": "ReentrancyGuardReentrantCall", "inputs": [] },
  { "type": "error", "name": "RepayAfterWithdrawalsEnabled", "inputs": [] },
  { "type": "error", "name": "RepayExceedsCap", "inputs": [] },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [{ "name": "token", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "SweepGracePeriodNotElapsed", "inputs": [] },
  { "type": "error", "name": "Unauthorized", "inputs": [] },
  { "type": "error", "name": "WithdrawalTooSmall", "inputs": [] },
  { "type": "error", "name": "WithdrawalsAlreadyEnabled", "inputs": [] },
  { "type": "error", "name": "WithdrawalsNotEnabled", "inputs": [] }
] as const;

export const YIELD_TOKEN_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "name_", "type": "string", "internalType": "string" },
      { "name": "symbol_", "type": "string", "internalType": "string" },
      { "name": "decimals_", "type": "uint8", "internalType": "uint8" },
      { "name": "vault_", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      { "name": "owner", "type": "address", "internalType": "address" },
      { "name": "spender", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "spender", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "burn",
    "inputs": [
      { "name": "from", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      { "name": "from", "type": "address", "internalType": "address" },
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      { "name": "owner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "spender", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "value", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      { "name": "from", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "to", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "value", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      { "name": "spender", "type": "address", "internalType": "address" },
      { "name": "allowance", "type": "uint256", "internalType": "uint256" },
      { "name": "needed", "type": "uint256", "internalType": "uint256" }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      { "name": "sender", "type": "address", "internalType": "address" },
      { "name": "balance", "type": "uint256", "internalType": "uint256" },
      { "name": "needed", "type": "uint256", "internalType": "uint256" }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [{ "name": "approver", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [{ "name": "receiver", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [{ "name": "sender", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [{ "name": "spender", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "OnlyVault", "inputs": [] }
] as const;

export const ERC20_ABI = [
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string", "internalType": "string" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      { "name": "owner", "type": "address", "internalType": "address" },
      { "name": "spender", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "spender", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      { "name": "from", "type": "address", "internalType": "address" },
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "value", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      { "name": "owner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "spender", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "value", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      { "name": "from", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "to", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "value", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  }
] as const;
