"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useVaultClient, useAccount } from "@/components/Providers";
import {
  VaultClient,
  PoolData,
  formatUnits,
  parseUnits,
  shortAddress,
  formatTimestamp,
  poolFillPercent,
  daysToMaturity,
  depositDeadlineTs,
  aprBpsToPercent,
  isMatured,
  isDepositOpen,
} from "@/lib/client";
import { getUserYieldBalance } from "@/lib/client";
import { VAULT_ADDRESS, fluentMainnet } from "@/lib/constants";

/* ---------- Pool Card ---------- */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-white font-medium text-sm">{value}</p>
      {sub && <p className="text-zinc-600 text-[10px] font-mono">{sub}</p>}
    </div>
  );
}

function PoolCard({
  pool,
  userYieldBalance,
  onDeposit,
  onWithdraw,
}: {
  pool: PoolData;
  userYieldBalance: bigint | null;
  onDeposit: (pool: PoolData) => void;
  onWithdraw: (pool: PoolData) => void;
}) {
  const matured = isMatured(pool.maturityTs);
  const depositOpen = isDepositOpen(pool.maturityTs, pool.depositDeadlineOffset);
  const apyPct = aprBpsToPercent(pool.aprBps);
  const fillPct = poolFillPercent(pool.totalDeposited, pool.maxTotalDeposit);
  const deadlineTs = depositDeadlineTs(pool.maturityTs, pool.depositDeadlineOffset);
  const dtm = daysToMaturity(pool.maturityTs);

  /* User expected return — mirrors Solana SDK userExpectedReturn():
     before withdrawals: yToken balance (already priced with interest at mint)
     after withdrawals:  yTokenBalance * totalRepaid / totalExpectedReturn
     (ratio is stable regardless of how many users have already withdrawn) */
  const expectedReturn: bigint | null =
    userYieldBalance !== null && userYieldBalance > 0n
      ? pool.withdrawalsEnabled && pool.totalExpectedReturn > 0n
        ? (userYieldBalance * pool.totalRepaid) / pool.totalExpectedReturn
        : userYieldBalance
      : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Pool #{pool.poolId.toString()}
          </h3>
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            matured
              ? "bg-emerald-900/60 text-emerald-400"
              : depositOpen
              ? "bg-indigo-900/60 text-indigo-400"
              : "bg-amber-900/60 text-amber-400"
          }`}
        >
          {matured ? "Matured" : depositOpen ? "Accepting Deposits" : "Deposit Closed"}
        </span>
      </div>

      {/* Pool capacity bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>{formatUnits(pool.totalDeposited, 6)} deposited</span>
          <span>{fillPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-0.5">Cap: {formatUnits(pool.maxTotalDeposit, 6)}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <Stat label="APY" value={`${apyPct}%`} />
        <Stat label="Maturity" value={formatTimestamp(pool.maturityTs)} sub={matured ? "Matured" : `${dtm}d left`} />
        <Stat label="Min Deposit" value={formatUnits(pool.minDepositAmount, 6)} />
        <Stat
          label="Deposit Deadline"
          value={deadlineTs ? formatTimestamp(deadlineTs) : "At maturity"}
        />
        <Stat label="Total Deposited" value={formatUnits(pool.totalDeposited, 6)} />
        <Stat label="Total Expected Return" value={formatUnits(pool.totalExpectedReturn, 6)} />
        <Stat label="Total Repaid" value={formatUnits(pool.totalRepaid, 6)} />
        <Stat label="Remaining Repay" value={formatUnits(pool.remainingRepay, 6)} />
        <Stat label="Withdrawals" value={pool.withdrawalsEnabled ? "Enabled" : "Disabled"} />
        <Stat label="Whitelist" value={pool.whitelistEnabled ? "Required" : "Open"} />
      </div>

      {/* Token addresses */}
      <div className="text-[10px] text-zinc-600 font-mono space-y-0.5 mb-4 border-t border-zinc-800 pt-3">
        <p>Deposit token: {pool.depositToken}</p>
        <p>Yield token: {pool.yieldToken}</p>
      </div>

      {/* User yToken info */}
      {userYieldBalance !== null && userYieldBalance > 0n && (
        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-zinc-400 mb-1">Your Position</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-zinc-500 text-xs">yToken Balance</p>
              <p className="text-white font-medium">{formatUnits(userYieldBalance, 6)}</p>
            </div>
            {expectedReturn && (
              <div>
                <p className="text-zinc-500 text-xs">Expected Return</p>
                <p className="text-emerald-400 font-medium">{formatUnits(expectedReturn, 6)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {depositOpen && !matured && (
          <button
            onClick={() => onDeposit(pool)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg py-2 transition"
          >
            Deposit
          </button>
        )}
        {pool.withdrawalsEnabled && (
          <button
            onClick={() => onWithdraw(pool)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg py-2 transition"
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function Home() {
  const client = useVaultClient();
  const { address } = useAccount();

  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* Deposit modal */
  const [depositTarget, setDepositTarget] = useState<PoolData | null>(null);
  const [depositAmount, setDepositAmount] = useState("");

  /* Withdraw modal */
  const [withdrawTarget, setWithdrawTarget] = useState<PoolData | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [txLoading, setTxLoading] = useState(false);

  /* yToken balances per pool (keyed by poolId string) */
  const [yieldBalances, setYieldBalances] = useState<Record<string, bigint>>({});

  /* Load pools */
  const loadPools = useCallback(async () => {
    if (!client || !VAULT_ADDRESS) return;
    setLoading(true);
    setError("");
    try {
      const poolData = await client.fetchAllPools();
      setPools(poolData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load pools");
    } finally {
      setLoading(false);
    }
  }, [client]);

  /* Load user yToken balances */
  useEffect(() => {
    if (!address || pools.length === 0) {
      setYieldBalances({});
      return;
    }
    const provider = new ethers.JsonRpcProvider(fluentMainnet.rpcUrls.default.http[0]);
    let cancelled = false;

    (async () => {
      const balances: Record<string, bigint> = {};
      await Promise.all(
        pools.map(async (p) => {
          try {
            const bal = await getUserYieldBalance(p.yieldToken, address, provider);
            balances[p.poolId.toString()] = bal;
          } catch {
            /* no balance */
          }
        })
      );
      if (!cancelled) setYieldBalances(balances);
    })();

    return () => { cancelled = true; };
  }, [address, pools]);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  /* Deposit */
  const handleDeposit = async () => {
    if (!client || !address || !depositTarget) return;
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const amount = parseUnits(depositAmount, 6);
      const tx = await client.deposit(depositTarget.poolId, amount);
      await tx.wait();
      setSuccess(`Deposit successful! Tx: ${tx.hash.slice(0, 18)}...`);
      setDepositTarget(null);
      setDepositAmount("");
      loadPools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setTxLoading(false);
    }
  };

  /* Withdraw */
  const handleWithdraw = async () => {
    if (!client || !address || !withdrawTarget) return;
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const amount = parseUnits(withdrawAmount, 6);
      const tx = await client.withdraw(withdrawTarget.poolId, amount);
      await tx.wait();
      setSuccess(`Withdrawal successful! Tx: ${tx.hash.slice(0, 18)}...`);
      setWithdrawTarget(null);
      setWithdrawAmount("");
      loadPools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Vault Pools</h1>
        <button
          onClick={loadPools}
          disabled={loading || !client}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {success}
        </div>
      )}

      {!client && (
        <div className="text-center text-zinc-500 py-20">
          Connect your wallet to view pools
        </div>
      )}

      {client && pools.length === 0 && !loading && (
        <div className="text-center text-zinc-500 py-20">
          No pools found
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pools.map((p) => (
          <PoolCard
            key={p.poolId.toString()}
            pool={p}
            userYieldBalance={yieldBalances[p.poolId.toString()] ?? null}
            onDeposit={(pool) => {
              setDepositTarget(pool);
              setDepositAmount("");
            }}
            onWithdraw={(pool) => {
              setWithdrawTarget(pool);
              setWithdrawAmount("");
            }}
          />
        ))}
      </div>

      {/* Deposit Modal */}
      <Modal
        title={`Deposit to Pool #${depositTarget?.poolId.toString() ?? ""}`}
        open={!!depositTarget}
        onClose={() => setDepositTarget(null)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Amount (tokens)
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {depositTarget && (
            <p className="text-xs text-zinc-500">
              Min: {formatUnits(depositTarget.minDepositAmount, 6)} · APY:{" "}
              {aprBpsToPercent(depositTarget.aprBps)}%
            </p>
          )}
          <button
            onClick={handleDeposit}
            disabled={txLoading || !depositAmount}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition"
          >
            {txLoading ? "Sending..." : "Deposit"}
          </button>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        title={`Withdraw from Pool #${withdrawTarget?.poolId.toString() ?? ""}`}
        open={!!withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
      >
        <div className="space-y-4">
          {withdrawTarget && yieldBalances[withdrawTarget.poolId.toString()] && (
            <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3">
              <p className="text-xs text-zinc-400">Your yToken balance</p>
              <p className="text-white font-medium">
                {formatUnits(yieldBalances[withdrawTarget.poolId.toString()], 6)}
              </p>
            </div>
          )}
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Amount (yield tokens to burn)
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {withdrawTarget && yieldBalances[withdrawTarget.poolId.toString()] && (
              <button
                className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                onClick={() =>
                  setWithdrawAmount(
                    formatUnits(yieldBalances[withdrawTarget.poolId.toString()], 6)
                  )
                }
              >
                Max
              </button>
            )}
          </div>
          <button
            onClick={handleWithdraw}
            disabled={txLoading || !withdrawAmount}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition"
          >
            {txLoading ? "Sending..." : "Withdraw"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
