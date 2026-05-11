## Yumi EVM Vaults (FixedVault)

`FixedVault` is a fixed-rate vault protocol (EVM port of the Solana `YumiSolanaVaults` program) built around **pools**. A user **deposits** an ERC‑20 deposit token and receives pool-specific **yTokens** (ERC‑20) representing **principal + interest accrued until maturity**. After maturity (and once withdrawals are enabled), the user **burns yTokens** to claim a pro-rata share of repaid funds.

### Key contracts

- **`src/FixedVault.sol`**: pool management, deposits, repay, withdrawals, whitelist permits, sweep.
- **`src/YieldToken.sol`**: per-pool ERC‑20 share token (yToken), minted on deposit and burned on withdrawal.

### Pool model

Each pool stores (see `FixedVault.Pool`):

- **`depositToken`**: ERC‑20 accepted for deposit, repay, and withdrawal.
- **`yieldToken`**: deployed `YieldToken` address for this pool.
- **`aprBps`**: APR in basis points (bps), max `4000` (40%).
- **`maturityTs`**: maturity timestamp.
- **`depositDeadlineOffset`**: how many seconds **before maturity** deposits close (0 = no early deadline).
- **`minDepositAmount`**, **`maxTotalDeposit`**: minimum deposit and pool cap.
- **`totalDeposited`**: total deposits in `depositToken`.
- **`totalExpectedReturn`**: total yTokens minted to users (total expected return).
- **`totalRepaid`**, **`remainingRepay`**: total repaid and remaining amount to distribute.
- **`withdrawalsEnabled`**: whether withdrawals are enabled (set by authority after maturity and once repay exists).
- **`whitelistEnabled`** + `permits`: whether whitelist is enabled and per-address deposit limits.
- **`allowOverpay`**: whether repaying above `totalExpectedReturn` is allowed (default false).

### yToken formula (principal + interest)

On deposit of `amount`, the vault mints:

\[
y = amount + \frac{amount \times aprBps \times durationSecs}{10{,}000 \times 365 \times 24 \times 3600}
\]

Where `durationSecs = maturityTs - block.timestamp` at the time of deposit. In code this is `FixedVault._calcExpectedReturn(...)`.

### Roles & permissions (Authority)

The contract has a single **`authority`**:

- **Creates pools** (`initPool`)
- **Updates pool parameters** (`updatePool`)
- **Withdraws deposited funds for allocation** (`adminWithdraw`)
- **Repays funds into the pool** (`repay`)
- **Enables withdrawals** after maturity (`enableWithdrawals`)
- **Sweeps unclaimed funds** after the grace period (`sweepRepayVault`)
- **Transfers authority** via a 2-step flow (`proposeAuthority` → `acceptAuthority`)

### Lifecycle (how the vault works)

Below is the intended flow in `FixedVault` (see the lifecycle header in `FixedVault.sol`):

1. **Pool creation**: `initPool(...)` (authority)
2. **User deposit**: `deposit(poolId, amount)`  
   - checks the deposit deadline and maturity
   - checks the whitelist permit (if enabled)
   - transfers `depositToken` into the vault
   - mints `yToken` to the user
3. **Admin withdraw**: `adminWithdraw(poolId, amount)` (authority)  
   - can withdraw at most \(totalDeposited - totalAdminWithdrawn\)
4. **Repay**: `repay(poolId, amount)` (authority)  
   - before withdrawals are enabled (`withdrawalsEnabled == false`)
   - if `allowOverpay == false`, cannot exceed `totalExpectedReturn`
   - funds accumulate in `remainingRepay` for distribution
5. **Enable withdrawals**: `enableWithdrawals(poolId)` (authority)  
   - only after maturity
   - only if `remainingRepay > 0`
6. **User withdrawal**: `withdraw(poolId, yTokenAmount)`  
   - after maturity and with `withdrawalsEnabled == true`
   - payout is **proportional to current `remainingRepay` and yToken totalSupply**
   - the last withdrawer (burning the remaining yToken supply) receives all remaining `remainingRepay`
7. **Sweep unclaimed funds**: `sweepRepayVault(poolId)` (authority)  
   - only after `SWEEP_GRACE_SECONDS` (180 days) after maturity
   - transfers the remaining `remainingRepay` to the authority

### Whitelist / permits

If `whitelistEnabled == true`, deposits are only allowed for addresses with a permit:

- `grantPermit(poolId, user, maxAmount, expiresAt)` (authority)
- `revokePermit(poolId, user)` (authority)

Permits can enforce:
- **`maxAmount`**: per-address total deposit limit (0 = unlimited)
- **`expiresAt`**: expiration time (0 = no expiry)

### Foundry scripts (operations)

All scripts use environment variables from `.env` (see `.env.example`) and are run via `forge script ... --broadcast`.

- **Deploy**: `script/Deploy.s.sol`  
  Deploys `FixedVault`, setting `authority` to the deployer.

#### Deploy (`Deploy.s.sol`)

1. Copy and fill `.env` from `.env.example`. For deployment you need at least **`PRIVATE_KEY`** (the deployer becomes the vault **authority**).
2. Run the script with an RPC URL. This repo defines named endpoints in `foundry.toml` (e.g. **`fluent_mainnet`** → `https://rpc.fluent.xyz`, chain id **25363**).

```bash
source .env

# Using a named RPC from foundry.toml (recommended)
forge script script/Deploy.s.sol:Deploy --rpc-url fluent_mainnet --broadcast

# Or any HTTP(S) RPC, e.g. from your provider
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

3. Set **`VAULT=`** in `.env` to the printed `FixedVault` address before running pool scripts. Optionally record the address in `sdk/src/deployments.ts` for the app/SDK default on that chain.

> **Foundry:** if `forge script --broadcast` fails with `Chain … not supported` on a custom chain id, upgrade Forge with `foundryup` (older stable releases may reject unknown chains).

#### Verify on FluentScan (`forge verify-contract`)

After deploy, verify `FixedVault` on [FluentScan](https://fluentscan.xyz) (Blockscout API). The constructor is `constructor(address authority_)` — use the **authority address from deployment** (the deployer EOA unless you changed it before verify). You can confirm the value on-chain:

```bash
cast call "$VAULT" "authority()(address)" --rpc-url https://rpc.fluent.xyz
```

`forge verify-contract` does not accept `--chain fluent_mainnet` in current Forge builds; pass **chain id `25363`** and the Blockscout verifier URL explicitly:

```bash
# Replace DEPLOYED_VAULT and AUTHORITY with your addresses (checksummed or lowercase is fine).
forge verify-contract \
  "$DEPLOYED_VAULT" \
  src/FixedVault.sol:FixedVault \
  --chain 25363 \
  --verifier blockscout \
  --verifier-url https://fluentscan.xyz/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" "$AUTHORITY") \
  --watch
```

Verification must use the **original** constructor `authority_` from the deployment transaction, not a later value if you transferred authority via `proposeAuthority` / `acceptAuthority`.

- **Create pool** (authority): `script/CreatePool.s.sol`
- **Deposit** (user): `script/DepositToPool.s.sol`
- **Repay** (authority): `script/RepayToPool.s.sol`
- **Withdraw** (user): `script/WithdrawFromPool.s.sol`
- **Update pool params** (authority): `script/UpdatePool.s.sol`
- **Change authority**: `script/ProposeAuthority.s.sol` → `script/AcceptAuthority.s.sol`

Other scripts use the same pattern (`source .env` then `forge script … --rpc-url … --broadcast`). Variables are documented in `.env.example` and in the docblocks of `script/*.s.sol`.

### Security & constraints (read this)

- **Single-token flow**: deposit/repay/withdraw all use the same `depositToken`.
- **yToken is required to withdraw**: for `withdraw(...)` to work, the user must hold the pool’s yTokens.
- **No withdrawals before maturity** and before `enableWithdrawals`.
- **Pro-rata distribution**: payout depends on the current `remainingRepay` and yToken `totalSupply` at withdrawal time; authority must repay correctly or users receive less than expected.
- **Authority risk**: `adminWithdraw` lets the authority remove deposited funds; the system assumes trust in the operator to repay.

### Useful Foundry commands

```bash
forge build
forge test
forge fmt
```
