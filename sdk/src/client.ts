import { ethers, Contract, ContractTransactionResponse, Signer } from "ethers";
import { FIXED_VAULT_ABI, YIELD_TOKEN_ABI, ERC20_ABI } from "./abi";
import {
  InitPoolParams,
  UpdatePoolParams,
  PoolData,
  PermitData,
} from "./types";

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3",
    inputs: [{
      name: "calls", type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "allowFailure", type: "bool" },
        { name: "callData", type: "bytes" },
      ],
    }],
    outputs: [{
      name: "returnData", type: "tuple[]",
      components: [
        { name: "success", type: "bool" },
        { name: "returnData", type: "bytes" },
      ],
    }],
    stateMutability: "view",
  },
] as const;

export class VaultClient {
  readonly contract: Contract;
  readonly signer: Signer;
  readonly address: string;

  constructor(vaultAddress: string, signer: Signer) {
    this.address = vaultAddress;
    this.signer = signer;
    this.contract = new Contract(vaultAddress, FIXED_VAULT_ABI, signer);
  }

  // ── Helpers ──

  /** Get an ERC-20 contract instance. */
  erc20(tokenAddress: string): Contract {
    return new Contract(tokenAddress, ERC20_ABI, this.signer);
  }

  /** Get a YieldToken contract instance. */
  yieldToken(ytAddress: string): Contract {
    return new Contract(ytAddress, YIELD_TOKEN_ABI, this.signer);
  }

  // ── Read methods ──

  async authority(): Promise<string> {
    return this.contract.authority();
  }

  async pendingAuthority(): Promise<string> {
    return this.contract.pendingAuthority();
  }

  async fetchPool(poolId: bigint): Promise<PoolData> {
    const r = await this.contract.pools(poolId);
    return {
      poolId: r.poolId_,
      depositToken: r.depositToken,
      yieldToken: r.yieldToken,
      aprBps: Number(r.aprBps),
      maturityTs: r.maturityTs,
      depositDeadlineOffset: r.depositDeadlineOffset,
      minDepositAmount: r.minDepositAmount,
      maxTotalDeposit: r.maxTotalDeposit,
      totalDeposited: r.totalDeposited,
      totalExpectedReturn: r.totalExpectedReturn,
      totalRepaid: r.totalRepaid,
      remainingRepay: r.remainingRepay,
      totalAdminWithdrawn: r.totalAdminWithdrawn,
      totalSwept: r.totalSwept,
      withdrawalsEnabled: r.withdrawalsEnabled,
      whitelistEnabled: r.whitelistEnabled,
      allowOverpay: r.allowOverpay,
    };
  }

  async poolExists(poolId: bigint): Promise<boolean> {
    const pool = await this.contract.pools(poolId);
    return pool.depositToken !== "0x0000000000000000000000000000000000000000";
  }

  /** Fetch all pool IDs from the on-chain nextPoolId counter. */
  async fetchAllPoolIds(): Promise<bigint[]> {
    const count: bigint = await this.contract.nextPoolId();
    return Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  }

  /** Fetch all pools in a single Multicall3 aggregate call. */
  async fetchAllPools(): Promise<PoolData[]> {
    const count = Number(await this.contract.nextPoolId());
    if (count === 0) return [];

    const iface = this.contract.interface;
    const vaultAddress = await this.contract.getAddress();
    const calls = Array.from({ length: count }, (_, i) => ({
      target: vaultAddress,
      allowFailure: false,
      callData: iface.encodeFunctionData("pools", [BigInt(i)]),
    }));

    const provider =
      (this.contract.runner as Signer | null)?.provider ??
      (this.contract.runner as ethers.Provider | null);
    const mc = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
    const results: { success: boolean; returnData: string }[] =
      await mc.aggregate3(calls);

    return results.map((r, i) => {
      const d = iface.decodeFunctionResult("pools", r.returnData);
      return {
        poolId: BigInt(i),
        depositToken: d.depositToken,
        yieldToken: d.yieldToken,
        aprBps: Number(d.aprBps),
        maturityTs: d.maturityTs,
        depositDeadlineOffset: d.depositDeadlineOffset,
        minDepositAmount: d.minDepositAmount,
        maxTotalDeposit: d.maxTotalDeposit,
        totalDeposited: d.totalDeposited,
        totalExpectedReturn: d.totalExpectedReturn,
        totalRepaid: d.totalRepaid,
        remainingRepay: d.remainingRepay,
        totalAdminWithdrawn: d.totalAdminWithdrawn,
        totalSwept: d.totalSwept,
        withdrawalsEnabled: d.withdrawalsEnabled,
        whitelistEnabled: d.whitelistEnabled,
        allowOverpay: d.allowOverpay,
      };
    });
  }

  async fetchPermit(poolId: bigint, user: string): Promise<PermitData> {
    const r = await this.contract.permits(poolId, user);
    return {
      maxAmount: r.maxAmount,
      amountUsed: r.amountUsed,
      expiresAt: r.expiresAt,
      exists: r.exists,
    };
  }

  // ── Authority transfer ──

  async proposeAuthority(newAuthority: string): Promise<ContractTransactionResponse> {
    return this.contract.proposeAuthority(newAuthority);
  }

  async acceptAuthority(): Promise<ContractTransactionResponse> {
    return this.contract.acceptAuthority();
  }

  // ── Pool lifecycle ──

  async initPool(params: InitPoolParams): Promise<ContractTransactionResponse> {
    return this.contract.initPool(params);
  }

  async updatePool(poolId: bigint, params: UpdatePoolParams): Promise<ContractTransactionResponse> {
    return this.contract.updatePool(poolId, params);
  }

  /**
   * Deposit into a pool. Automatically approves the vault for the deposit amount
   * if allowance is insufficient.
   */
  async deposit(
    poolId: bigint,
    amount: bigint,
    opts?: { skipApproval?: boolean }
  ): Promise<ContractTransactionResponse> {
    if (!opts?.skipApproval) {
      const pool = await this.fetchPool(poolId);
      const token = this.erc20(pool.depositToken);
      const signerAddr = await this.signer.getAddress();
      const allowance: bigint = await token.allowance(signerAddr, this.address);
      if (allowance < amount) {
        const tx = await token.approve(this.address, amount);
        await tx.wait();
      }
    }
    return this.contract.deposit(poolId, amount);
  }

  async adminWithdraw(poolId: bigint, amount: bigint): Promise<ContractTransactionResponse> {
    return this.contract.adminWithdraw(poolId, amount);
  }

  /**
   * Repay into a pool. Automatically approves the vault for the repay amount
   * if allowance is insufficient.
   */
  async repay(
    poolId: bigint,
    amount: bigint,
    opts?: { skipApproval?: boolean }
  ): Promise<ContractTransactionResponse> {
    if (!opts?.skipApproval) {
      const pool = await this.fetchPool(poolId);
      const token = this.erc20(pool.depositToken);
      const signerAddr = await this.signer.getAddress();
      const allowance: bigint = await token.allowance(signerAddr, this.address);
      if (allowance < amount) {
        const tx = await token.approve(this.address, amount);
        await tx.wait();
      }
    }
    return this.contract.repay(poolId, amount);
  }

  async enableWithdrawals(poolId: bigint): Promise<ContractTransactionResponse> {
    return this.contract.enableWithdrawals(poolId);
  }

  async withdraw(poolId: bigint, amount: bigint): Promise<ContractTransactionResponse> {
    return this.contract.withdraw(poolId, amount);
  }

  async sweepRepayVault(poolId: bigint): Promise<ContractTransactionResponse> {
    return this.contract.sweepRepayVault(poolId);
  }

  // ── Permits ──

  async grantPermit(
    poolId: bigint,
    user: string,
    maxAmount: bigint,
    expiresAt: bigint
  ): Promise<ContractTransactionResponse> {
    return this.contract.grantPermit(poolId, user, maxAmount, expiresAt);
  }

  async revokePermit(poolId: bigint, user: string): Promise<ContractTransactionResponse> {
    return this.contract.revokePermit(poolId, user);
  }
}
