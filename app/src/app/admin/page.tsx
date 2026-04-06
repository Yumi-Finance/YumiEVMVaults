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
  SWEEP_GRACE_SECONDS,
} from "@/lib/client";
import { VAULT_ADDRESS, FUSD_ADDRESS, fluentTestnet } from "@/lib/constants";

/* ---------- Section wrapper ---------- */

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-zinc-800/50 transition"
      >
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-zinc-500 text-lg">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

/* ---------- Input helpers ---------- */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm text-zinc-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const btnPrimary =
  "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";
const btnDanger =
  "bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";
const btnSuccess =
  "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 px-5 transition text-sm";

const POOLS_PER_PAGE = 5;

/* ---------- Collapsible Pool Row ---------- */

function PoolRow({ pool }: { pool: PoolData }) {
  const [expanded, setExpanded] = useState(false);
  const matured = isMatured(pool.maturityTs);
  const depositOpen = isDepositOpen(pool.maturityTs, pool.depositDeadlineOffset);
  const dtm = daysToMaturity(pool.maturityTs);
  const fillPct = poolFillPercent(pool.totalDeposited, pool.maxTotalDeposit);
  const deadlineTs = depositDeadlineTs(pool.maturityTs, pool.depositDeadlineOffset);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/80 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white font-semibold text-sm shrink-0">
            Pool #{pool.poolId.toString()}
          </span>
          <span className="text-xs text-zinc-500">{aprBpsToPercent(pool.aprBps)}% APR</span>
          <span className="text-xs text-zinc-500">·</span>
          <span className="text-xs text-zinc-500">{formatUnits(pool.totalDeposited, 6)} deposited</span>
          {/* Mini fill bar */}
          <div className="hidden sm:block w-16 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              matured
                ? "bg-emerald-900/60 text-emerald-400"
                : depositOpen
                ? "bg-indigo-900/60 text-indigo-400"
                : "bg-amber-900/60 text-amber-400"
            }`}
          >
            {matured ? "Matured" : depositOpen ? "Open" : "Closed"}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              pool.withdrawalsEnabled
                ? "bg-emerald-900/60 text-emerald-400"
                : "bg-zinc-700 text-zinc-400"
            }`}
          >
            {pool.withdrawalsEnabled ? "W:On" : "W:Off"}
          </span>
          {pool.whitelistEnabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/60 text-violet-400">WL</span>
          )}
          {pool.allowOverpay && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-400">Overpay</span>
          )}
          <span className="text-zinc-500 text-sm ml-1">{expanded ? "−" : "+"}</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-700/50">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Deposited: {formatUnits(pool.totalDeposited, 6)}</span>
              <span>{fillPct.toFixed(1)}% of {formatUnits(pool.maxTotalDeposit, 6)}</span>
            </div>
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${fillPct}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-xs mb-3">
            <div>
              <span className="text-zinc-500">APR</span>
              <p className="text-zinc-200 font-medium">{aprBpsToPercent(pool.aprBps)}%</p>
            </div>
            <div>
              <span className="text-zinc-500">Maturity</span>
              <p className="text-zinc-200">{formatTimestamp(pool.maturityTs)}</p>
              <p className="text-zinc-600 text-[10px]">{matured ? "Matured" : `${dtm}d remaining`}</p>
            </div>
            <div>
              <span className="text-zinc-500">Deposit Deadline</span>
              <p className="text-zinc-200">{deadlineTs ? formatTimestamp(deadlineTs) : "At maturity"}</p>
            </div>
            <div>
              <span className="text-zinc-500">Min Deposit</span>
              <p className="text-zinc-200">{formatUnits(pool.minDepositAmount, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Pool Cap</span>
              <p className="text-zinc-200">{formatUnits(pool.maxTotalDeposit, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Total Expected Return</span>
              <p className="text-zinc-200">{formatUnits(pool.totalExpectedReturn, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Total Repaid</span>
              <p className="text-zinc-200">{formatUnits(pool.totalRepaid, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Admin Withdrawn</span>
              <p className="text-zinc-200">{formatUnits(pool.totalAdminWithdrawn, 6)}</p>
            </div>
            <div>
              <span className="text-zinc-500">Remaining Repay</span>
              <p className={`font-medium ${pool.remainingRepay > 0n ? "text-amber-400" : "text-emerald-400"}`}>
                {formatUnits(pool.remainingRepay, 6)}
              </p>
            </div>
          </div>

          {/* Addresses */}
          <div className="text-[10px] text-zinc-600 font-mono space-y-0.5 border-t border-zinc-700 pt-2">
            <p>Deposit Token: {pool.depositToken}</p>
            <p>Yield Token: {pool.yieldToken}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pool List with pagination ---------- */

function PoolList({ pools }: { pools: PoolData[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pools.length / POOLS_PER_PAGE);
  const visible = pools.slice(page * POOLS_PER_PAGE, (page + 1) * POOLS_PER_PAGE);

  return (
    <div>
      <div className="space-y-2">
        {visible.map((p) => (
          <PoolRow key={p.poolId.toString()} pool={p} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
          <button
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            className="text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition px-3 py-1"
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition px-3 py-1"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Admin Page ---------- */

export default function AdminPage() {
  const client = useVaultClient();
  const { address } = useAccount();

  const [authority, setAuthority] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<string | null>(null);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  /* Load authority + pools */
  const refresh = useCallback(async () => {
    if (!client || !VAULT_ADDRESS) return;
    setLoading(true);
    setError("");
    try {
      const [auth, pending] = await Promise.all([
        client.authority(),
        client.pendingAuthority(),
      ]);
      setAuthority(auth);
      setPendingAuth(pending !== ethers.ZeroAddress ? pending : null);

      const poolData = await client.fetchAllPools();
      setPools(poolData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* generic tx helper */
  const execTx = async (label: string, fn: () => Promise<ethers.ContractTransactionResponse>) => {
    setTxLoading(true);
    setError("");
    setSuccess("");
    try {
      const tx = await fn();
      await tx.wait();
      setSuccess(`${label} successful! Tx: ${tx.hash.slice(0, 18)}...`);
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setTxLoading(false);
    }
  };

  /* ============ Propose Authority ============ */
  const [newAuthority, setNewAuthority] = useState("");
  const handleProposeAuthority = () => {
    if (!client || !newAuthority) return;
    execTx("Propose Authority", () => client.proposeAuthority(newAuthority));
  };

  const handleAcceptAuthority = () => {
    if (!client) return;
    execTx("Accept Authority", () => client.acceptAuthority());
  };

  /* ============ Create Pool ============ */
  const [cpAprBps, setCpAprBps] = useState("");
  const [cpMaturityDate, setCpMaturityDate] = useState("");
  const [cpDeadlineOffset, setCpDeadlineOffset] = useState("0");
  const [cpMinDeposit, setCpMinDeposit] = useState("");
  const [cpMaxDeposit, setCpMaxDeposit] = useState("");
  const [cpMintAddr, setCpMintAddr] = useState(FUSD_ADDRESS);
  const [cpWhitelist, setCpWhitelist] = useState(false);

  const handleCreatePool = () => {
    if (!client || !cpMintAddr) return;
    execTx("Create Pool", () => {
      const maturityTs = BigInt(Math.floor(new Date(cpMaturityDate).getTime() / 1000));
      return client.initPool({
        depositToken: cpMintAddr,
        aprBps: parseInt(cpAprBps),
        maturityTs,
        depositDeadlineOffset: BigInt(cpDeadlineOffset),
        minDepositAmount: parseUnits(cpMinDeposit, 6),
        maxTotalDeposit: parseUnits(cpMaxDeposit, 6),
        whitelistEnabled: cpWhitelist,
      });
    });
  };

  /* ============ Update Pool ============ */
  const [upPoolId, setUpPoolId] = useState("");
  const [upAprBps, setUpAprBps] = useState("");
  const [upMinDeposit, setUpMinDeposit] = useState("");
  const [upMaxDeposit, setUpMaxDeposit] = useState("");
  const [upAllowOverpay, setUpAllowOverpay] = useState(false);

  const handleUpdatePool = () => {
    if (!client || !upPoolId) return;
    execTx("Update Pool", () =>
      client.updatePool(BigInt(upPoolId), {
        updateAprBps: upAprBps !== "",
        aprBps: upAprBps ? parseInt(upAprBps) : 0,
        updateMinDepositAmount: upMinDeposit !== "",
        minDepositAmount: upMinDeposit ? parseUnits(upMinDeposit, 6) : 0n,
        updateMaxTotalDeposit: upMaxDeposit !== "",
        maxTotalDeposit: upMaxDeposit ? parseUnits(upMaxDeposit, 6) : 0n,
        updateAllowOverpay: upAllowOverpay,
        allowOverpay: upAllowOverpay,
      })
    );
  };

  /* ============ Admin Withdraw ============ */
  const [awPoolId, setAwPoolId] = useState("");
  const [awAmount, setAwAmount] = useState("");

  const handleAdminWithdraw = () => {
    if (!client || !awPoolId || !awAmount) return;
    execTx("Admin Withdraw", () =>
      client.adminWithdraw(BigInt(awPoolId), parseUnits(awAmount, 6))
    );
  };

  /* ============ Repay ============ */
  const [rpPoolId, setRpPoolId] = useState("");
  const [rpAmount, setRpAmount] = useState("");

  const handleRepay = () => {
    if (!client || !rpPoolId || !rpAmount) return;
    execTx("Repay", () =>
      client.repay(BigInt(rpPoolId), parseUnits(rpAmount, 6))
    );
  };

  /* ============ Enable Withdrawals ============ */
  const [ewPoolId, setEwPoolId] = useState("");

  const handleEnableWithdrawals = () => {
    if (!client || !ewPoolId) return;
    execTx("Enable Withdrawals", () =>
      client.enableWithdrawals(BigInt(ewPoolId))
    );
  };

  /* ============ Sweep Repay Vault ============ */
  const [swPoolId, setSwPoolId] = useState("");

  const handleSweepRepayVault = () => {
    if (!client || !swPoolId) return;
    execTx("Sweep Repay Vault", () =>
      client.sweepRepayVault(BigInt(swPoolId))
    );
  };

  /* ============ Grant Permit ============ */
  const [gpPoolId, setGpPoolId] = useState("");
  const [gpUser, setGpUser] = useState("");
  const [gpMaxAmount, setGpMaxAmount] = useState("0");
  const [gpExpiresAt, setGpExpiresAt] = useState("0");

  const handleGrantPermit = () => {
    if (!client || !gpPoolId || !gpUser) return;
    execTx("Grant Permit", () =>
      client.grantPermit(
        BigInt(gpPoolId),
        gpUser,
        parseUnits(gpMaxAmount, 6),
        BigInt(gpExpiresAt)
      )
    );
  };

  /* ============ Revoke Permit ============ */
  const [rvPoolId, setRvPoolId] = useState("");
  const [rvUser, setRvUser] = useState("");

  const handleRevokePermit = () => {
    if (!client || !rvPoolId || !rvUser) return;
    execTx("Revoke Permit", () =>
      client.revokePermit(BigInt(rvPoolId), rvUser)
    );
  };

  /* Pool select dropdown */
  const poolOptions = pools.map((p) => ({
    label: `Pool #${p.poolId.toString()}`,
    value: p.poolId.toString(),
  }));

  function PoolSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select pool...</option>
        {poolOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  /* Find selected pool data */
  function selectedPool(poolId: string): PoolData | undefined {
    if (!poolId) return undefined;
    return pools.find((p) => p.poolId.toString() === poolId);
  }

  /* ============ Render ============ */

  if (!client) {
    return (
      <div className="text-center text-zinc-500 py-20">
        Connect your wallet to access the admin panel
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Authority Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4">
        <p className="text-sm text-zinc-400 mb-1">Vault Authority</p>
        {authority ? (
          <div className="space-y-1">
            <p className="text-sm text-white">
              Authority: <span className="font-mono text-xs">{authority}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Connected as: <span className="font-mono">{address}</span>
              {address && authority.toLowerCase() === address.toLowerCase() ? (
                <span className="text-emerald-400 ml-2">You are the authority</span>
              ) : (
                <span className="text-red-400 ml-2">Not authority — admin actions will fail</span>
              )}
            </p>
            <p className="text-xs text-zinc-600">
              Pools: {pools.length}
            </p>
            {pendingAuth && (
              <p className="text-xs text-amber-400">
                Pending Authority: <span className="font-mono">{pendingAuth}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Loading...</p>
        )}
      </div>

      {/* Transfer Authority (Two-step) */}
      <Section title="Transfer Authority">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Two-step process: propose a new authority, then the new authority must accept.</p>
          <Field label="New Authority Address">
            <input
              className={inputCls}
              placeholder="0x..."
              value={newAuthority}
              onChange={(e) => setNewAuthority(e.target.value)}
            />
          </Field>
          <div className="flex gap-3">
            <button
              onClick={handleProposeAuthority}
              disabled={txLoading || !newAuthority}
              className={btnDanger}
            >
              Propose Authority
            </button>
            <button
              onClick={handleAcceptAuthority}
              disabled={txLoading || !(pendingAuth && address && pendingAuth.toLowerCase() === address.toLowerCase())}
              className={btnPrimary}
            >
              Accept Authority
            </button>
          </div>
        </div>
      </Section>

      {/* Create Pool */}
      <Section title="Create Pool" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <Field label="APR (basis points)">
            <input
              className={inputCls}
              type="number"
              placeholder="800 = 8%"
              value={cpAprBps}
              onChange={(e) => setCpAprBps(e.target.value)}
            />
          </Field>
          <Field label="Maturity Date">
            <input
              className={inputCls}
              type="datetime-local"
              value={cpMaturityDate}
              onChange={(e) => setCpMaturityDate(e.target.value)}
            />
          </Field>
          <Field label="Deposit Deadline Offset (sec)">
            <input
              className={inputCls}
              type="number"
              placeholder="0"
              value={cpDeadlineOffset}
              onChange={(e) => setCpDeadlineOffset(e.target.value)}
            />
          </Field>
          <Field label="Min Deposit (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="1.0"
              value={cpMinDeposit}
              onChange={(e) => setCpMinDeposit(e.target.value)}
            />
          </Field>
          <Field label="Max Total Deposit (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="1000000"
              value={cpMaxDeposit}
              onChange={(e) => setCpMaxDeposit(e.target.value)}
            />
          </Field>
          <Field label="Deposit Token Address">
            <input
              className={inputCls}
              placeholder={FUSD_ADDRESS}
              value={cpMintAddr}
              onChange={(e) => setCpMintAddr(e.target.value)}
            />
          </Field>
          <Field label="Whitelist">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cpWhitelist}
                onChange={(e) => setCpWhitelist(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800"
              />
              <span className="text-sm text-zinc-300">Enable whitelist</span>
            </label>
          </Field>
        </div>
        <button
          onClick={handleCreatePool}
          disabled={txLoading || !cpMintAddr}
          className={`${btnPrimary} mt-4`}
        >
          Create Pool
        </button>
      </Section>

      {/* Existing Pools */}
      <Section title={`Pools (${pools.length})`} defaultOpen>
        {pools.length === 0 ? (
          <p className="text-sm text-zinc-500">No pools found</p>
        ) : (
          <PoolList pools={pools} />
        )}
      </Section>

      {/* Update Pool */}
      <Section title="Update Pool">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={upPoolId} onChange={setUpPoolId} />
          </Field>
          {(() => {
            const sp = selectedPool(upPoolId);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Current APR: <span className="text-white">{aprBpsToPercent(sp.aprBps)}%</span></div>
                <div>Current Min: <span className="text-white">{formatUnits(sp.minDepositAmount, 6)}</span></div>
                <div>Current Cap: <span className="text-white">{formatUnits(sp.maxTotalDeposit, 6)}</span></div>
              </div>
            );
          })()}
          <div className="grid grid-cols-3 gap-3">
            <Field label="New APR (bps, optional)">
              <input
                className={inputCls}
                type="number"
                placeholder="Leave empty to skip"
                value={upAprBps}
                onChange={(e) => setUpAprBps(e.target.value)}
              />
            </Field>
            <Field label="Min Deposit (optional)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                placeholder="Leave empty to skip"
                value={upMinDeposit}
                onChange={(e) => setUpMinDeposit(e.target.value)}
              />
            </Field>
            <Field label="Max Deposit (optional)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                placeholder="Leave empty to skip"
                value={upMaxDeposit}
                onChange={(e) => setUpMaxDeposit(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={upAllowOverpay}
              onChange={(e) => setUpAllowOverpay(e.target.checked)}
            />
            Allow overpay (irreversible)
          </label>
          <button
            onClick={handleUpdatePool}
            disabled={txLoading || !upPoolId}
            className={btnPrimary}
          >
            Update Pool
          </button>
        </div>
      </Section>

      {/* Admin Withdraw */}
      <Section title="Admin Withdraw">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={awPoolId} onChange={setAwPoolId} />
          </Field>
          {(() => {
            const sp = selectedPool(awPoolId);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-2 gap-2">
                <div>Total Deposited: <span className="text-white">{formatUnits(sp.totalDeposited, 6)}</span></div>
                <div>Admin Withdrawn: <span className="text-white">{formatUnits(sp.totalAdminWithdrawn, 6)}</span></div>
                <div>Available: <span className="text-amber-400 font-medium">{formatUnits(sp.totalDeposited - sp.totalAdminWithdrawn, 6)}</span></div>
              </div>
            );
          })()}
          <Field label="Amount (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="0.00"
              value={awAmount}
              onChange={(e) => setAwAmount(e.target.value)}
            />
          </Field>
          <button
            onClick={handleAdminWithdraw}
            disabled={txLoading || !awPoolId || !awAmount}
            className={btnDanger}
          >
            Admin Withdraw
          </button>
        </div>
      </Section>

      {/* Repay */}
      <Section title="Repay">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={rpPoolId} onChange={setRpPoolId} />
          </Field>
          {(() => {
            const sp = selectedPool(rpPoolId);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay > 0n ? "text-amber-400" : "text-emerald-400"}`}>{formatUnits(sp.remainingRepay, 6)}</span></div>
                <div>Total Repaid: <span className="text-white">{formatUnits(sp.totalRepaid, 6)}</span></div>
                <div>Total Expected Return: <span className="text-white">{formatUnits(sp.totalExpectedReturn, 6)}</span></div>
              </div>
            );
          })()}
          <Field label="Amount (tokens)">
            <input
              className={inputCls}
              type="number"
              step="0.000001"
              placeholder="0.00"
              value={rpAmount}
              onChange={(e) => setRpAmount(e.target.value)}
            />
          </Field>
          <button
            onClick={handleRepay}
            disabled={txLoading || !rpPoolId || !rpAmount}
            className={btnSuccess}
          >
            Repay
          </button>
        </div>
      </Section>

      {/* Enable Withdrawals */}
      <Section title="Enable Withdrawals">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={ewPoolId} onChange={setEwPoolId} />
          </Field>
          {(() => {
            const sp = selectedPool(ewPoolId);
            if (!sp) return null;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-3 gap-2">
                <div>Status: <span className={sp.withdrawalsEnabled ? "text-emerald-400" : "text-amber-400"}>{sp.withdrawalsEnabled ? "Already enabled" : "Disabled"}</span></div>
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay > 0n ? "text-amber-400" : "text-emerald-400"}`}>{formatUnits(sp.remainingRepay, 6)}</span></div>
                <div>Matured: <span className={isMatured(sp.maturityTs) ? "text-emerald-400" : "text-zinc-300"}>{isMatured(sp.maturityTs) ? "Yes" : "No"}</span></div>
              </div>
            );
          })()}
          <button
            onClick={handleEnableWithdrawals}
            disabled={txLoading || !ewPoolId}
            className={btnSuccess}
          >
            Enable Withdrawals
          </button>
        </div>
      </Section>

      {/* Sweep Repay Vault */}
      <Section title="Sweep Repay Vault">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Recover orphaned repay funds after {Number(SWEEP_GRACE_SECONDS / 86400n)} days post-maturity.
          </p>
          <Field label="Pool">
            <PoolSelect value={swPoolId} onChange={setSwPoolId} />
          </Field>
          {(() => {
            const sp = selectedPool(swPoolId);
            if (!sp) return null;
            const sweepAfter = sp.maturityTs + SWEEP_GRACE_SECONDS;
            const nowBn = BigInt(Math.floor(Date.now() / 1000));
            const canSweep = nowBn >= sweepAfter && sp.withdrawalsEnabled && sp.remainingRepay > 0n;
            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 text-xs text-zinc-400 grid grid-cols-2 gap-2">
                <div>Remaining Repay: <span className={`font-medium ${sp.remainingRepay > 0n ? "text-amber-400" : "text-emerald-400"}`}>{formatUnits(sp.remainingRepay, 6)}</span></div>
                <div>Sweep Available: <span className={canSweep ? "text-emerald-400" : "text-amber-400"}>{canSweep ? "Yes" : `After ${formatTimestamp(sweepAfter)}`}</span></div>
                <div>Withdrawals: <span className={sp.withdrawalsEnabled ? "text-emerald-400" : "text-amber-400"}>{sp.withdrawalsEnabled ? "Enabled" : "Disabled"}</span></div>
              </div>
            );
          })()}
          <button
            onClick={handleSweepRepayVault}
            disabled={txLoading || !swPoolId}
            className={btnDanger}
          >
            Sweep Repay Vault
          </button>
        </div>
      </Section>

      {/* Grant Permit */}
      <Section title="Grant Deposit Permit">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={gpPoolId} onChange={setGpPoolId} />
          </Field>
          <Field label="User Address">
            <input
              className={inputCls}
              placeholder="0x..."
              value={gpUser}
              onChange={(e) => setGpUser(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max Amount (tokens, 0 = unlimited)">
              <input
                className={inputCls}
                type="number"
                step="0.000001"
                value={gpMaxAmount}
                onChange={(e) => setGpMaxAmount(e.target.value)}
              />
            </Field>
            <Field label="Expires At (unix ts, 0 = none)">
              <input
                className={inputCls}
                type="number"
                value={gpExpiresAt}
                onChange={(e) => setGpExpiresAt(e.target.value)}
              />
            </Field>
          </div>
          <button
            onClick={handleGrantPermit}
            disabled={txLoading || !gpPoolId || !gpUser}
            className={btnPrimary}
          >
            Grant Permit
          </button>
        </div>
      </Section>

      {/* Revoke Permit */}
      <Section title="Revoke Deposit Permit">
        <div className="space-y-3">
          <Field label="Pool">
            <PoolSelect value={rvPoolId} onChange={setRvPoolId} />
          </Field>
          <Field label="User Address">
            <input
              className={inputCls}
              placeholder="0x..."
              value={rvUser}
              onChange={(e) => setRvUser(e.target.value)}
            />
          </Field>
          <button
            onClick={handleRevokePermit}
            disabled={txLoading || !rvPoolId || !rvUser}
            className={btnDanger}
          >
            Revoke Permit
          </button>
        </div>
      </Section>
    </div>
  );
}
