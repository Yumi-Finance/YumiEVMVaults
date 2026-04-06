// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {YieldToken} from "./YieldToken.sol";

/// @title FixedVault
/// @notice Fixed-rate vault protocol – EVM port of the Solana YumiSolanaVaults program.
///
/// Lifecycle per pool:
///   1. Authority creates a pool (initPool) with APR, maturity, caps.
///   2. Users deposit the deposit token and receive yTokens (principal + accrued interest).
///   3. Authority withdraws deposited funds (adminWithdraw) to deploy capital.
///   4. Authority repays principal + yield into the pool (repay).
///   5. Authority enables withdrawals after maturity (enableWithdrawals).
///   6. Users burn yTokens to claim proportional share of repaid funds (withdraw).
///   7. After a 180-day grace period, authority can sweep unclaimed funds (sweepRepayVault).
contract FixedVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────── Constants ─────────────────────────────

    /// @notice Maximum allowed APR in basis points (4000 bps = 40%).
    uint16 public constant MAX_APR_BPS = 4000;

    /// @notice Divisor: 10_000 (bps base) × 365 × 24 × 3600 = 315_360_000_000.
    uint256 private constant BPS_YEAR_DIVISOR = 315_360_000_000;

    /// @notice Grace period after maturity before sweep is allowed (180 days).
    uint256 public constant SWEEP_GRACE_SECONDS = 15_552_000;

    // ──────────────────────────── Authority ──────────────────────────────

    address public authority;
    address public pendingAuthority;

    // ──────────────────────────── Pool state ─────────────────────────────

    struct Pool {
        uint64 poolId;
        address depositToken;
        address yieldToken; // deployed YieldToken per pool
        uint16 aprBps;
        int64 maturityTs;
        uint64 depositDeadlineOffset;
        uint64 minDepositAmount;
        uint64 maxTotalDeposit;
        uint64 totalDeposited;
        uint64 totalExpectedReturn;
        uint64 totalRepaid;
        uint64 remainingRepay;
        uint64 totalAdminWithdrawn;
        uint64 totalSwept;
        bool withdrawalsEnabled;
        bool whitelistEnabled;
        bool allowOverpay;
    }

    /// @notice poolId → Pool
    mapping(uint64 => Pool) public pools;

    /// @notice Auto-incrementing counter; next pool gets this ID.
    uint64 public nextPoolId;

    // ──────────────────────────── Permit state ───────────────────────────

    struct DepositPermit {
        uint64 maxAmount;
        uint64 amountUsed;
        int64 expiresAt;
        bool exists;
    }

    /// @notice poolId → user → DepositPermit
    mapping(uint64 => mapping(address => DepositPermit)) public permits;

    // ──────────────────────────── Events ─────────────────────────────────

    event PoolInitialized(uint64 indexed poolId, address depositToken, address yieldToken);

    event DepositEvent(
        uint64 indexed poolId,
        address indexed user,
        uint64 amount,
        uint64 yTokensMinted,
        uint64 totalDeposited,
        uint256 ts
    );

    event WithdrawEvent(
        uint64 indexed poolId,
        address indexed user,
        uint64 yTokensBurned,
        uint64 payout,
        uint64 remainingRepay,
        uint256 ts
    );

    event RepayEvent(
        uint64 indexed poolId,
        address indexed authority_,
        uint64 amount,
        uint64 totalRepaid,
        uint64 remainingRepay,
        uint256 ts
    );

    event AdminWithdrawEvent(
        uint64 indexed poolId,
        address indexed authority_,
        uint64 amount,
        uint64 totalAdminWithdrawn,
        uint256 ts
    );

    event EnableWithdrawalsEvent(
        uint64 indexed poolId,
        address indexed authority_,
        uint64 totalRepaid,
        uint64 totalExpectedReturn,
        uint256 ts
    );

    event AuthorityProposed(address indexed current, address indexed proposed);
    event AuthorityTransferred(address indexed previous, address indexed newAuthority);

    // ──────────────────────────── Errors ─────────────────────────────────

    error Unauthorized();
    error NoPendingAuthority();
    error PoolDoesNotExist();
    error InvalidMaturity();
    error AprTooHigh();
    error DecimalsTooHigh();
    error InvalidDeadlineOffset();
    error DepositTooSmall();
    error PoolCapExceeded();
    error DepositDeadlinePassed();
    error NotWhitelisted();
    error PermitExpired();
    error PermitLimitExceeded();
    error MathOverflow();
    error MaturityNotReached();
    error WithdrawalsNotEnabled();
    error WithdrawalsAlreadyEnabled();
    error WithdrawalTooSmall();
    error NoRepayRemaining();
    error RepayAfterWithdrawalsEnabled();
    error NoRepayToDistribute();
    error RepayExceedsCap();
    error CannotRevokeOverpay();
    error CapBelowActive();
    error AdminWithdrawExceeded();
    error SweepGracePeriodNotElapsed();
    error NothingToSweep();

    // ──────────────────────────── Modifiers ──────────────────────────────

    modifier onlyAuthority() {
        if (msg.sender != authority) revert Unauthorized();
        _;
    }

    modifier poolMustExist(uint64 poolId) {
        if (pools[poolId].depositToken == address(0)) revert PoolDoesNotExist();
        _;
    }

    // ──────────────────────────── Constructor ────────────────────────────

    constructor(address authority_) {
        authority = authority_;
    }

    // ──────────────────── Authority transfer (2-step) ────────────────────

    function proposeAuthority(address newAuthority) external onlyAuthority {
        pendingAuthority = newAuthority;
        emit AuthorityProposed(authority, newAuthority);
    }

    function acceptAuthority() external {
        if (msg.sender != pendingAuthority) revert NoPendingAuthority();
        emit AuthorityTransferred(authority, msg.sender);
        authority = msg.sender;
        pendingAuthority = address(0);
    }

    // ──────────────────────────── Init Pool ──────────────────────────────

    struct InitPoolParams {
        address depositToken;
        uint16 aprBps;
        int64 maturityTs;
        uint64 depositDeadlineOffset;
        uint64 minDepositAmount;
        uint64 maxTotalDeposit;
        bool whitelistEnabled;
    }

    function initPool(InitPoolParams calldata params) external onlyAuthority returns (uint64 poolId) {
        poolId = nextPoolId++;

        int64 now_ = int64(int256(block.timestamp));
        if (params.maturityTs <= now_) revert InvalidMaturity();
        if (params.aprBps > MAX_APR_BPS) revert AprTooHigh();

        uint8 decs = _tokenDecimals(params.depositToken);
        if (decs > 18) revert DecimalsTooHigh();

        uint64 durationSecs = uint64(int64(params.maturityTs) - now_);

        _calcExpectedReturn(params.maxTotalDeposit, params.aprBps, durationSecs);

        if (params.depositDeadlineOffset >= durationSecs) revert InvalidDeadlineOffset();

        YieldToken yt = new YieldToken(
            string.concat("Yumi Yield Pool ", _uint64ToString(poolId)),
            string.concat("yYUMI-", _uint64ToString(poolId)),
            decs,
            address(this)
        );

        Pool storage pool = pools[poolId];
        pool.poolId = poolId;
        pool.depositToken = params.depositToken;
        pool.yieldToken = address(yt);
        pool.aprBps = params.aprBps;
        pool.maturityTs = params.maturityTs;
        pool.depositDeadlineOffset = params.depositDeadlineOffset;
        pool.minDepositAmount = params.minDepositAmount;
        pool.maxTotalDeposit = params.maxTotalDeposit;
        pool.whitelistEnabled = params.whitelistEnabled;

        emit PoolInitialized(poolId, params.depositToken, address(yt));
    }

    // ──────────────────────────── Deposit ────────────────────────────────

    function deposit(uint64 poolId, uint64 amount) external nonReentrant poolMustExist(poolId) {
        Pool storage pool = pools[poolId];
        int64 now_ = int64(int256(block.timestamp));

        // Check deposit deadline
        if (pool.depositDeadlineOffset > 0) {
            int64 deadline = pool.maturityTs - int64(uint64(pool.depositDeadlineOffset));
            if (now_ > deadline) revert DepositDeadlinePassed();
        }

        // Check maturity not passed
        if (pool.maturityTs <= now_) revert DepositDeadlinePassed();
        uint64 timeToMaturity = uint64(int64(pool.maturityTs) - now_);

        if (amount < pool.minDepositAmount) revert DepositTooSmall();

        // Whitelist check
        if (pool.whitelistEnabled) {
            DepositPermit storage permit = permits[poolId][msg.sender];
            if (!permit.exists) revert NotWhitelisted();
            if (permit.expiresAt > 0 && now_ > permit.expiresAt) revert PermitExpired();
            if (permit.maxAmount > 0) {
                uint64 newUsed = permit.amountUsed + amount;
                if (newUsed < permit.amountUsed) revert MathOverflow(); // overflow
                if (newUsed > permit.maxAmount) revert PermitLimitExceeded();
                permit.amountUsed = newUsed;
            }
        }

        // Calculate yield token mint amount
        uint64 mintAmount = _calcExpectedReturn(amount, pool.aprBps, timeToMaturity);

        // Update pool totals
        uint64 newTotalDeposited = pool.totalDeposited + amount;
        if (newTotalDeposited < pool.totalDeposited) revert MathOverflow();
        if (newTotalDeposited > pool.maxTotalDeposit) revert PoolCapExceeded();
        pool.totalDeposited = newTotalDeposited;

        uint64 newTotalExpected = pool.totalExpectedReturn + mintAmount;
        if (newTotalExpected < pool.totalExpectedReturn) revert MathOverflow();
        pool.totalExpectedReturn = newTotalExpected;

        // Transfer deposit token from user to this contract
        IERC20(pool.depositToken).safeTransferFrom(msg.sender, address(this), amount);

        // Mint yTokens to user
        YieldToken(pool.yieldToken).mint(msg.sender, mintAmount);

        emit DepositEvent(poolId, msg.sender, amount, mintAmount, pool.totalDeposited, block.timestamp);
    }

    // ──────────────────────────── Admin Withdraw ─────────────────────────

    function adminWithdraw(uint64 poolId, uint64 amount)
        external
        onlyAuthority
        nonReentrant
        poolMustExist(poolId)
    {
        Pool storage pool = pools[poolId];

        uint64 maxWithdrawable = pool.totalDeposited - pool.totalAdminWithdrawn;
        if (amount > maxWithdrawable) revert AdminWithdrawExceeded();

        pool.totalAdminWithdrawn = pool.totalAdminWithdrawn + amount;

        IERC20(pool.depositToken).safeTransfer(msg.sender, amount);

        emit AdminWithdrawEvent(poolId, msg.sender, amount, pool.totalAdminWithdrawn, block.timestamp);
    }

    // ──────────────────────────── Repay ──────────────────────────────────

    function repay(uint64 poolId, uint64 amount)
        external
        onlyAuthority
        nonReentrant
        poolMustExist(poolId)
    {
        Pool storage pool = pools[poolId];

        if (pool.withdrawalsEnabled) revert RepayAfterWithdrawalsEnabled();
        if (pool.totalExpectedReturn == 0) revert NoRepayToDistribute();

        if (!pool.allowOverpay) {
            uint64 newTotalRepaid = pool.totalRepaid + amount;
            if (newTotalRepaid < pool.totalRepaid) revert MathOverflow();
            if (newTotalRepaid > pool.totalExpectedReturn) revert RepayExceedsCap();
        }

        IERC20(pool.depositToken).safeTransferFrom(msg.sender, address(this), amount);

        pool.totalRepaid = pool.totalRepaid + amount;
        pool.remainingRepay = pool.remainingRepay + amount;

        emit RepayEvent(poolId, msg.sender, amount, pool.totalRepaid, pool.remainingRepay, block.timestamp);
    }

    // ──────────────────────── Enable Withdrawals ─────────────────────────

    function enableWithdrawals(uint64 poolId) external onlyAuthority poolMustExist(poolId) {
        Pool storage pool = pools[poolId];
        int64 now_ = int64(int256(block.timestamp));

        if (pool.withdrawalsEnabled) revert WithdrawalsAlreadyEnabled();
        if (now_ < pool.maturityTs) revert MaturityNotReached();
        if (pool.remainingRepay == 0) revert NoRepayToDistribute();

        pool.withdrawalsEnabled = true;

        emit EnableWithdrawalsEvent(
            poolId, msg.sender, pool.totalRepaid, pool.totalExpectedReturn, block.timestamp
        );
    }

    // ──────────────────────────── Withdraw ───────────────────────────────

    function withdraw(uint64 poolId, uint64 amount)
        external
        nonReentrant
        poolMustExist(poolId)
    {
        if (amount == 0) revert WithdrawalTooSmall();
        Pool storage pool = pools[poolId];

        if (int64(int256(block.timestamp)) < pool.maturityTs) revert MaturityNotReached();
        if (!pool.withdrawalsEnabled) revert WithdrawalsNotEnabled();
        if (pool.remainingRepay == 0) revert NoRepayRemaining();

        YieldToken yt = YieldToken(pool.yieldToken);
        uint256 supply = yt.totalSupply();

        // Calculate proportional payout BEFORE burning
        uint64 payout;
        if (amount == supply) {
            // Last withdrawer gets everything remaining
            payout = pool.remainingRepay;
        } else {
            payout = uint64(
                (uint256(amount) * uint256(pool.remainingRepay)) / supply
            );
        }

        // Burn yTokens from user (user must have approved the vault)
        yt.burn(msg.sender, amount);

        // Transfer payout
        IERC20(pool.depositToken).safeTransfer(msg.sender, payout);

        pool.remainingRepay = pool.remainingRepay - payout;

        emit WithdrawEvent(poolId, msg.sender, amount, payout, pool.remainingRepay, block.timestamp);
    }

    // ──────────────────────────── Update Pool ────────────────────────────

    struct UpdatePoolParams {
        bool updateMaxTotalDeposit;
        uint64 maxTotalDeposit;
        bool updateMinDepositAmount;
        uint64 minDepositAmount;
        bool updateAprBps;
        uint16 aprBps;
        bool updateAllowOverpay;
        bool allowOverpay;
    }

    function updatePool(uint64 poolId, UpdatePoolParams calldata params)
        external
        onlyAuthority
        poolMustExist(poolId)
    {
        Pool storage pool = pools[poolId];

        if (params.updateMaxTotalDeposit) {
            if (params.maxTotalDeposit < pool.totalDeposited) revert CapBelowActive();
            pool.maxTotalDeposit = params.maxTotalDeposit;
        }
        if (params.updateMinDepositAmount) {
            pool.minDepositAmount = params.minDepositAmount;
        }
        if (params.updateAprBps) {
            if (params.aprBps > MAX_APR_BPS) revert AprTooHigh();
            pool.aprBps = params.aprBps;
        }
        if (params.updateAllowOverpay) {
            if (!params.allowOverpay && pool.allowOverpay) revert CannotRevokeOverpay();
            pool.allowOverpay = params.allowOverpay;
        }

        // Dry-run worst-case
        int64 now_ = int64(int256(block.timestamp));
        uint64 durationSecs = pool.maturityTs > now_ ? uint64(int64(pool.maturityTs) - now_) : 0;
        _calcExpectedReturn(pool.maxTotalDeposit, pool.aprBps, durationSecs);
    }

    // ──────────────────────────── Permits ────────────────────────────────

    function grantPermit(uint64 poolId, address user, uint64 maxAmount, int64 expiresAt)
        external
        onlyAuthority
        poolMustExist(poolId)
    {
        int64 now_ = int64(int256(block.timestamp));
        if (expiresAt != 0 && expiresAt <= now_) revert PermitExpired();

        DepositPermit storage permit = permits[poolId][user];
        permit.maxAmount = maxAmount;
        permit.amountUsed = 0;
        permit.expiresAt = expiresAt;
        permit.exists = true;
    }

    function revokePermit(uint64 poolId, address user)
        external
        onlyAuthority
        poolMustExist(poolId)
    {
        delete permits[poolId][user];
    }

    // ────────────────────── Sweep Repay Vault ────────────────────────────

    function sweepRepayVault(uint64 poolId)
        external
        onlyAuthority
        nonReentrant
        poolMustExist(poolId)
    {
        Pool storage pool = pools[poolId];

        if (!pool.withdrawalsEnabled) revert WithdrawalsNotEnabled();

        uint256 sweepAfter = uint256(int256(pool.maturityTs)) + SWEEP_GRACE_SECONDS;
        if (block.timestamp < sweepAfter) revert SweepGracePeriodNotElapsed();

        uint64 amount = pool.remainingRepay;
        if (amount == 0) revert NothingToSweep();

        pool.totalSwept = pool.remainingRepay;
        pool.remainingRepay = 0;

        IERC20(pool.depositToken).safeTransfer(msg.sender, amount);
    }

    // ──────────────────── Internal helpers ────────────────────────────────

    /// @dev Computes principal + interest: amount + (amount × aprBps × durationSecs) / 315_360_000_000
    function _calcExpectedReturn(uint64 amount, uint16 aprBps, uint64 durationSecs)
        internal
        pure
        returns (uint64)
    {
        uint256 interest = (uint256(amount) * uint256(aprBps) * uint256(durationSecs)) / BPS_YEAR_DIVISOR;
        uint256 total = uint256(amount) + interest;
        if (total > type(uint64).max) revert MathOverflow();
        return uint64(total);
    }

    /// @dev Read decimals() from an ERC-20 token. Falls back to 18 if call fails.
    function _tokenDecimals(address token) internal view returns (uint8) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (ok && data.length >= 32) {
            uint256 dec = abi.decode(data, (uint256));
            return uint8(dec);
        }
        return 18;
    }

    /// @dev uint64 → ASCII string (for token name/symbol generation).
    function _uint64ToString(uint64 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
