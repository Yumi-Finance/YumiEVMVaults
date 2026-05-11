// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {FixedVault} from "../src/FixedVault.sol";
import {YieldToken} from "../src/YieldToken.sol";
import {MockERC20} from "./MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev decimals() as uint256 returning 256 — uint8 cast would truncate to 0 without full-range checks.
contract TruncatingDecimalsMock {
    function decimals() external pure returns (uint256) {
        return 256;
    }
}

contract FixedVaultTest is Test {
    FixedVault vault;
    MockERC20 usdc;

    address authority;
    address user1;
    address user2;
    address attacker;

    uint64 constant POOL_ID = 0;
    uint16 constant APR_BPS = 800; // 8%
    uint64 constant MIN_DEPOSIT = 100_000_000; // 100 USDC
    uint64 constant MAX_TOTAL_DEPOSIT = 5_000_000_000; // 5000 USDC
    uint64 constant DEPOSIT_AMOUNT = 1_000_000_000; // 1000 USDC

    int64 maturityTs;

    function setUp() public {
        authority = makeAddr("authority");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        attacker = makeAddr("attacker");

        vm.startPrank(authority);
        vault = new FixedVault(authority);
        vm.stopPrank();

        usdc = new MockERC20("USDC", "USDC", 6);

        // Fund accounts
        usdc.mint(authority, 10_000_000_000);
        usdc.mint(user1, 5_000_000_000);
        usdc.mint(user2, 5_000_000_000);

        maturityTs = int64(int256(block.timestamp + 90 days));
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    function _initDefaultPool() internal returns (uint64) {
        return _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
    }

    function _initPool(
        uint16 aprBps,
        int64 maturity,
        uint64 deadlineOffset,
        uint64 minDeposit,
        uint64 maxDeposit,
        bool whitelist
    ) internal returns (uint64) {
        vm.prank(authority);
        return vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: aprBps,
                maturityTs: maturity,
                depositDeadlineOffset: deadlineOffset,
                minDepositAmount: minDeposit,
                maxTotalDeposit: maxDeposit,
                whitelistEnabled: whitelist
            })
        );
    }

    function _deposit(address user, uint64 poolId, uint64 amount) internal {
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        vault.deposit(poolId, amount);
        vm.stopPrank();
    }

    function _getYieldToken(uint64 poolId) internal view returns (YieldToken) {
        (,,address yt,,,,,,,,,,,,,,,) = vault.pools(poolId);
        return YieldToken(yt);
    }

    function _getPoolData(uint64 poolId) internal view returns (
        uint64 totalDeposited,
        uint64 totalExpectedReturn,
        uint64 totalRepaid,
        uint64 remainingRepay,
        uint64 totalAdminWithdrawn,
        bool withdrawalsEnabled,
        bool allowOverpay
    ) {
        (,,,,,,, /*maxTotal*/,
         uint64 td, uint64 ter, uint64 tr, uint64 rr, uint64 taw, /*swept*/,
         bool we, /*wl*/, bool ao, bool _initialized) = vault.pools(poolId);
        return (td, ter, tr, rr, taw, we, ao);
    }

    // ========================================================================
    // init_pool
    // ========================================================================

    function test_initPool() public {
        uint64 pid = _initDefaultPool();

        assertTrue(vault.nextPoolId() > pid);

        (
            uint64 storedId,
            address dt,
            address yt,
            uint16 apr,
            int64 mat,
            uint64 ddo,
            uint64 minDep,
            uint64 maxDep,,,,,,,,,,bool initialized
        ) = vault.pools(pid);

        assertEq(storedId, pid);
        assertTrue(initialized);

        (,,,,,,,, uint64 td, uint64 ter, uint64 tr, uint64 rr, uint64 taw, uint64 tsw,,,,bool _unusedInit) =
            vault.pools(pid);

        (,,,,,,,,,,,,,,bool we, bool wl, bool ao, bool _unusedInit2) = vault.pools(pid);

        assertEq(dt, address(usdc));
        assertTrue(yt != address(0));
        assertEq(apr, APR_BPS);
        assertEq(mat, maturityTs);
        assertEq(ddo, 0);
        assertEq(minDep, MIN_DEPOSIT);
        assertEq(maxDep, MAX_TOTAL_DEPOSIT);
        assertEq(td, 0);
        assertEq(ter, 0);
        assertEq(tr, 0);
        assertEq(rr, 0);
        assertEq(taw, 0);
        assertEq(tsw, 0);
        assertFalse(we);
        assertFalse(wl);
        assertFalse(ao);
    }

    function test_initPool_rejectsNonAuthority() public {
        vm.prank(attacker);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_rejectsDuplicatePoolId_skipped() public pure { /* n/a: IDs are auto-assigned */ }

    function test_initPool_rejectsPastMaturity() public {
        vm.prank(authority);
        vm.expectRevert(FixedVault.InvalidMaturity.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: APR_BPS,
                maturityTs: int64(int256(block.timestamp - 1)),
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_rejectsZeroDepositToken() public {
        vm.prank(authority);
        vm.expectRevert(FixedVault.InvalidDepositToken.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(0),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_zeroDepositToken_doesNotConsumePoolId() public {
        uint64 nextBefore = vault.nextPoolId();

        vm.prank(authority);
        vm.expectRevert(FixedVault.InvalidDepositToken.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(0),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );

        assertEq(vault.nextPoolId(), nextBefore);

        uint64 pid = _initDefaultPool();
        assertEq(pid, nextBefore);
    }

    function test_initPool_rejectsAprTooHigh() public {
        vm.prank(authority);
        vm.expectRevert(FixedVault.AprTooHigh.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: 4001,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_acceptsAprAtCap() public {
        uint64 pid = _initPool(4000, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        (,,,uint16 apr,,,,,,,,,,,,,,) = vault.pools(pid);
        assertEq(apr, 4000);
    }

    function test_initPool_rejectsHighDecimals() public {
        MockERC20 highDec = new MockERC20("HD", "HD", 19);
        vm.prank(authority);
        vm.expectRevert(FixedVault.DecimalsTooHigh.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(highDec),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_rejectsDecimalsTruncationBypass() public {
        TruncatingDecimalsMock bad = new TruncatingDecimalsMock();
        vm.prank(authority);
        vm.expectRevert(FixedVault.DecimalsTooHigh.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(bad),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_rejectsInvalidDeadlineOffset() public {
        int64 shortMaturity = int64(int256(block.timestamp + 60));
        vm.prank(authority);
        vm.expectRevert(FixedVault.InvalidDeadlineOffset.selector);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: APR_BPS,
                maturityTs: shortMaturity,
                depositDeadlineOffset: 120,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_initPool_acceptsValidDeadlineOffset() public {
        uint64 pid = _initPool(APR_BPS, maturityTs, 86400, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        (,,,, /*mat*/, uint64 ddo,,,,,,,,,,,, ) = vault.pools(pid);
        assertEq(ddo, 86400);
    }

    // ========================================================================
    // deposit
    // ========================================================================

    function test_deposit_success() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint256 yBal = yt.balanceOf(user1);
        assertGt(yBal, DEPOSIT_AMOUNT); // principal + interest > principal
    }

    function test_deposit_rejectsBelowMinimum() public {
        _initDefaultPool();
        vm.startPrank(user1);
        usdc.approve(address(vault), 50_000_000);
        vm.expectRevert(FixedVault.DepositTooSmall.selector);
        vault.deposit(POOL_ID, 50_000_000);
        vm.stopPrank();
    }

    function test_deposit_rejectsExceedingPoolCap() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.startPrank(user1);
        usdc.approve(address(vault), MAX_TOTAL_DEPOSIT);
        vm.expectRevert(FixedVault.PoolCapExceeded.selector);
        vault.deposit(POOL_ID, MAX_TOTAL_DEPOSIT);
        vm.stopPrank();
    }

    function test_deposit_rejectsAfterMaturity() public {
        _initDefaultPool();
        vm.warp(uint256(int256(maturityTs)) + 1);

        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert(FixedVault.DepositDeadlinePassed.selector);
        vault.deposit(POOL_ID, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_deposit_rejectsNonExistentPool() public {
        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert(FixedVault.PoolDoesNotExist.selector);
        vault.deposit(999, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_deposit_exactlyAtCap() public {
        uint64 tinyMax = 200_000_000; // 200 USDC
        uint64 pid = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, tinyMax, false);

        _deposit(user1, pid, tinyMax);

        (,,,,,,,, uint64 td,,,,,,,,,) = vault.pools(pid);
        assertEq(td, tinyMax);

        // One more should fail
        vm.startPrank(user1);
        usdc.approve(address(vault), MIN_DEPOSIT);
        vm.expectRevert(FixedVault.PoolCapExceeded.selector);
        vault.deposit(pid, MIN_DEPOSIT);
        vm.stopPrank();
    }

    // ========================================================================
    // admin_withdraw
    // ========================================================================

    function test_adminWithdraw_success() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        uint256 balBefore = usdc.balanceOf(authority);
        vm.prank(authority);
        vault.adminWithdraw(POOL_ID, DEPOSIT_AMOUNT);
        uint256 balAfter = usdc.balanceOf(authority);

        assertEq(balAfter - balBefore, DEPOSIT_AMOUNT);
    }

    function test_adminWithdraw_rejectsExceedDeposits() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.prank(authority);
        vm.expectRevert(FixedVault.AdminWithdrawExceeded.selector);
        vault.adminWithdraw(POOL_ID, DEPOSIT_AMOUNT + 1);
    }

    function test_adminWithdraw_rejectsNonAuthority() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.prank(attacker);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.adminWithdraw(POOL_ID, DEPOSIT_AMOUNT);
    }

    // ========================================================================
    // repay
    // ========================================================================

    function test_repay_tracksMultipleRepays() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        uint64 repay1 = 500_000_000;
        uint64 repay2 = 300_000_000;

        vm.startPrank(authority);
        usdc.approve(address(vault), repay1 + repay2);
        vault.repay(POOL_ID, repay1);

        (,,,,,,,,, /*ter*/, uint64 tr1, uint64 rr1,,,,,, ) = vault.pools(POOL_ID);
        assertEq(tr1, repay1);
        assertEq(rr1, repay1);

        vault.repay(POOL_ID, repay2);
        vm.stopPrank();

        (,,,,,,,,, /*ter*/, uint64 tr2, uint64 rr2,,,,,, ) = vault.pools(POOL_ID);
        assertEq(tr2, repay1 + repay2);
        assertEq(rr2, repay1 + repay2);
    }

    function test_repay_rejectsAfterWithdrawalsEnabled() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 totalExpected = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), totalExpected);
        vault.repay(POOL_ID, totalExpected);

        vm.warp(uint256(int256(maturityTs)));
        vault.enableWithdrawals(POOL_ID);

        usdc.approve(address(vault), 1);
        vm.expectRevert(FixedVault.RepayAfterWithdrawalsEnabled.selector);
        vault.repay(POOL_ID, 1);
        vm.stopPrank();
    }

    function test_repay_rejectsOnEmptyPool() public {
        uint64 emptyPid = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        // No deposits → totalExpectedReturn == 0

        vm.startPrank(authority);
        usdc.approve(address(vault), 1_000_000);
        vm.expectRevert(FixedVault.NoRepayToDistribute.selector);
        vault.repay(emptyPid, 1_000_000);
        vm.stopPrank();
    }

    function test_repay_rejectsExceedingCap() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 totalExpected = uint64(yt.balanceOf(user1));
        uint64 overAmount = totalExpected + 1;

        vm.startPrank(authority);
        usdc.approve(address(vault), overAmount);
        vm.expectRevert(FixedVault.RepayExceedsCap.selector);
        vault.repay(POOL_ID, overAmount);
        vm.stopPrank();
    }

    function test_repay_allowsExactExpected() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 totalExpected = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), totalExpected);
        vault.repay(POOL_ID, totalExpected);
        vm.stopPrank();

        (, , , uint64 tr, , , ) = _getPoolData(POOL_ID);
        assertEq(tr, totalExpected);
    }

    function test_repay_rejectsNonAuthority() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.startPrank(attacker);
        usdc.approve(address(vault), 1);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.repay(POOL_ID, 1);
        vm.stopPrank();
    }

    // ========================================================================
    // withdraw
    // ========================================================================

    function test_withdraw_rejectsBeforeMaturity() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.prank(user1);
        vm.expectRevert(FixedVault.MaturityNotReached.selector);
        vault.withdraw(POOL_ID, yBal);
    }

    function test_withdraw_rejectsWhenNotEnabled() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        // Repay and warp to maturity but don't enable
        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));

        vm.prank(user1);
        vm.expectRevert(FixedVault.WithdrawalsNotEnabled.selector);
        vault.withdraw(POOL_ID, yBal);
    }

    function test_withdraw_rejectsZeroAmount() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));
        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);

        vm.prank(attacker);
        vm.expectRevert(FixedVault.WithdrawalTooSmall.selector);
        vault.withdraw(POOL_ID, 0);
    }

    function test_withdraw_fullCycle() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));
        assertGt(yBal, DEPOSIT_AMOUNT);

        // Admin withdraw deposited funds
        vm.prank(authority);
        vault.adminWithdraw(POOL_ID, DEPOSIT_AMOUNT);

        // Repay full expected return
        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        // Warp to maturity and enable
        vm.warp(uint256(int256(maturityTs)));
        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);

        // Withdraw
        uint256 userBalBefore = usdc.balanceOf(user1);
        vm.prank(user1);
        vault.withdraw(POOL_ID, yBal);
        uint256 userBalAfter = usdc.balanceOf(user1);

        // User gets more than deposited (principal + interest)
        assertGt(userBalAfter - userBalBefore, DEPOSIT_AMOUNT);

        // yTokens burned
        assertEq(yt.balanceOf(user1), 0);

        // Pool remaining_repay is 0
        (, , , uint64 rr, , , ) = _getPoolData(POOL_ID);
        assertEq(rr, 0);
    }

    function test_withdraw_rejectsWhenNoRepayRemaining() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));
        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);

        // Withdraw all
        vm.prank(user1);
        vault.withdraw(POOL_ID, yBal);

        // Try again — no repay remaining
        vm.prank(user1);
        vm.expectRevert(FixedVault.NoRepayRemaining.selector);
        vault.withdraw(POOL_ID, 1);
    }

    // ========================================================================
    // enable_withdrawals
    // ========================================================================

    function test_enableWithdrawals_rejectsBeforeMaturity() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.prank(authority);
        vm.expectRevert(FixedVault.MaturityNotReached.selector);
        vault.enableWithdrawals(POOL_ID);
    }

    function test_enableWithdrawals_rejectsNoRepay() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.warp(uint256(int256(maturityTs)));

        vm.prank(authority);
        vm.expectRevert(FixedVault.NoRepayToDistribute.selector);
        vault.enableWithdrawals(POOL_ID);
    }

    function test_enableWithdrawals_rejectsDoubleEnable() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));

        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);

        vm.prank(authority);
        vm.expectRevert(FixedVault.WithdrawalsAlreadyEnabled.selector);
        vault.enableWithdrawals(POOL_ID);
    }

    function test_enableWithdrawals_rejectsNonAuthority() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));

        vm.prank(attacker);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.enableWithdrawals(POOL_ID);
    }

    // ========================================================================
    // update_pool
    // ========================================================================

    function test_updatePool_capAndApr() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT); // total_deposited = 1000

        uint64 newMax = 10_000_000_000;
        vm.prank(authority);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: true,
                maxTotalDeposit: newMax,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: true,
                aprBps: 1200,
                updateAllowOverpay: false,
                allowOverpay: false
            })
        );

        (,,, uint16 apr,,,, uint64 maxDep,,,,,,,,,, ) = vault.pools(POOL_ID);
        assertEq(maxDep, newMax);
        assertEq(apr, 1200);
    }

    function test_updatePool_rejectsCapBelowActive() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.prank(authority);
        vm.expectRevert(FixedVault.CapBelowActive.selector);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: true,
                maxTotalDeposit: 1, // below total_deposited
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: false,
                aprBps: 0,
                updateAllowOverpay: false,
                allowOverpay: false
            })
        );
    }

    function test_updatePool_rejectsAprAboveCap() public {
        _initDefaultPool();

        vm.prank(authority);
        vm.expectRevert(FixedVault.AprTooHigh.selector);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: false,
                maxTotalDeposit: 0,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: true,
                aprBps: 4001,
                updateAllowOverpay: false,
                allowOverpay: false
            })
        );
    }

    // ========================================================================
    // whitelist / permits
    // ========================================================================

    function test_whitelist_rejectsWithoutPermit() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert(FixedVault.NotWhitelisted.selector);
        vault.deposit(wlPoolId, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_whitelist_permitAllowsDeposit() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, 0, 0);

        _deposit(user1, wlPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(wlPoolId);
        assertGt(yt.balanceOf(user1), 0);
    }

    function test_whitelist_revokePermit() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, 0, 0);

        vm.prank(authority);
        vault.revokePermit(wlPoolId, user1);

        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert(FixedVault.NotWhitelisted.selector);
        vault.deposit(wlPoolId, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_permit_rejectsExpiredAtCreation() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        vm.prank(authority);
        vm.expectRevert(FixedVault.PermitExpired.selector);
        vault.grantPermit(wlPoolId, user1, 0, 1); // expires_at = 1 (far in the past)
    }

    function test_permit_expiryAllowsBeforeExpiry() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        int64 futureExpiry = int64(int256(block.timestamp + 3600));
        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, 0, futureExpiry);

        _deposit(user1, wlPoolId, MIN_DEPOSIT);
        YieldToken yt = _getYieldToken(wlPoolId);
        assertGt(yt.balanceOf(user1), 0);
    }

    function test_permit_rejectsExpiredDeposit() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        int64 futureExpiry = int64(int256(block.timestamp + 100));
        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, 0, futureExpiry);

        // Warp past expiry
        vm.warp(block.timestamp + 200);

        vm.startPrank(user1);
        usdc.approve(address(vault), MIN_DEPOSIT);
        vm.expectRevert(FixedVault.PermitExpired.selector);
        vault.deposit(wlPoolId, MIN_DEPOSIT);
        vm.stopPrank();
    }

    function test_permit_maxAmountEnforced() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        uint64 maxAmt = 300_000_000; // 300 USDC: 3x MIN_DEPOSIT
        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, maxAmt, 0);

        // Deposit 1: 100 USDC
        _deposit(user1, wlPoolId, MIN_DEPOSIT);

        (uint64 permitMax, uint64 permitUsed, , ) = vault.permits(wlPoolId, user1);
        assertEq(permitUsed, MIN_DEPOSIT);

        // Deposit 2: 100 USDC (200 used)
        _deposit(user1, wlPoolId, MIN_DEPOSIT);

        // Deposit 3: 200 USDC => 400 used > 300 max → fail
        vm.startPrank(user1);
        usdc.approve(address(vault), 200_000_000);
        vm.expectRevert(FixedVault.PermitLimitExceeded.selector);
        vault.deposit(wlPoolId, 200_000_000);
        vm.stopPrank();

        // Deposit exactly 100 USDC → 300/300 → OK
        _deposit(user1, wlPoolId, MIN_DEPOSIT);

        (, uint64 usedAfter, , ) = vault.permits(wlPoolId, user1);
        assertEq(usedAfter, maxAmt);
    }

    // ========================================================================
    // allow_overpay
    // ========================================================================

    function test_allowOverpay_defaultFalse() public {
        _initDefaultPool();
        (, , , , , , bool ao) = _getPoolData(POOL_ID);
        assertFalse(ao);
    }

    function test_allowOverpay_rejectsOverRepay() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 totalExpected = uint64(yt.balanceOf(user1));
        uint64 overAmount = totalExpected + 1;

        vm.startPrank(authority);
        usdc.approve(address(vault), overAmount);
        vm.expectRevert(FixedVault.RepayExceedsCap.selector);
        vault.repay(POOL_ID, overAmount);
        vm.stopPrank();
    }

    function test_allowOverpay_enableAndOverRepay() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        // Enable allow_overpay
        vm.prank(authority);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: false,
                maxTotalDeposit: 0,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: false,
                aprBps: 0,
                updateAllowOverpay: true,
                allowOverpay: true
            })
        );

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 totalExpected = uint64(yt.balanceOf(user1));
        uint64 overAmount = totalExpected + 1;

        vm.startPrank(authority);
        usdc.approve(address(vault), overAmount);
        vault.repay(POOL_ID, overAmount);
        vm.stopPrank();

        (, , uint64 tr, , , , ) = _getPoolData(POOL_ID);
        assertGt(tr, totalExpected);
    }

    function test_allowOverpay_cannotRevoke() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        // Enable
        vm.prank(authority);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: false,
                maxTotalDeposit: 0,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: false,
                aprBps: 0,
                updateAllowOverpay: true,
                allowOverpay: true
            })
        );

        // Try to revoke
        vm.prank(authority);
        vm.expectRevert(FixedVault.CannotRevokeOverpay.selector);
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: false,
                maxTotalDeposit: 0,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: false,
                aprBps: 0,
                updateAllowOverpay: true,
                allowOverpay: false
            })
        );
    }

    // ========================================================================
    // propose_authority / accept_authority
    // ========================================================================

    function test_authorityTransfer() public {
        address newAuth = makeAddr("newAuth");

        // Reject from non-authority
        vm.prank(attacker);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.proposeAuthority(newAuth);

        // Propose
        vm.prank(authority);
        vault.proposeAuthority(newAuth);
        assertEq(vault.pendingAuthority(), newAuth);

        // Reject from wrong acceptor
        vm.prank(attacker);
        vm.expectRevert(FixedVault.NoPendingAuthority.selector);
        vault.acceptAuthority();

        // Accept
        vm.prank(newAuth);
        vault.acceptAuthority();
        assertEq(vault.authority(), newAuth);
        assertEq(vault.pendingAuthority(), address(0));

        // Restore
        vm.prank(newAuth);
        vault.proposeAuthority(authority);
        vm.prank(authority);
        vault.acceptAuthority();
        assertEq(vault.authority(), authority);
    }

    // ========================================================================
    // multiple pools
    // ========================================================================

    function test_multiplePools() public {
        uint64 pid0 = _initDefaultPool();
        uint64 pid1 = _initPool(1200, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);

        _deposit(user1, pid0, DEPOSIT_AMOUNT);
        _deposit(user1, pid1, DEPOSIT_AMOUNT);

        (,,,,,,,, uint64 td0,,,,,,,,,) = vault.pools(pid0);
        (,,,,,,,, uint64 td1,,,,,,,,,) = vault.pools(pid1);

        assertEq(td0, DEPOSIT_AMOUNT);
        assertEq(td1, DEPOSIT_AMOUNT);
    }

    // ========================================================================
    // multi-user proportional withdrawals
    // ========================================================================

    function test_multiUserProportionalWithdrawals() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 muPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);

        uint64 user1Deposit = 200_000_000; // 200 USDC
        uint64 user2Deposit = 800_000_000; // 800 USDC (4x more)

        _deposit(user1, muPoolId, user1Deposit);
        _deposit(user2, muPoolId, user2Deposit);

        YieldToken yt = _getYieldToken(muPoolId);
        uint64 user1YBal = uint64(yt.balanceOf(user1));
        uint64 user2YBal = uint64(yt.balanceOf(user2));
        assertGt(user2YBal, user1YBal);

        // Admin withdraw + repay full expected
        uint64 totalDeposited = user1Deposit + user2Deposit;
        vm.prank(authority);
        vault.adminWithdraw(muPoolId, totalDeposited);

        uint64 totalExpected = user1YBal + user2YBal;
        vm.startPrank(authority);
        usdc.approve(address(vault), totalExpected);
        vault.repay(muPoolId, totalExpected);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(muPoolId);

        // User1 withdraws
        uint256 supply = yt.totalSupply();
        (, , , uint64 rr, , , ) = _getPoolData(muPoolId);
        uint64 expected1 = uint64((uint256(user1YBal) * uint256(rr)) / supply);

        uint256 u1Before = usdc.balanceOf(user1);
        vm.prank(user1);
        vault.withdraw(muPoolId, user1YBal);
        uint256 u1Payout = usdc.balanceOf(user1) - u1Before;
        assertEq(u1Payout, expected1);

        // User2 withdraws (last withdrawer)
        uint256 u2Before = usdc.balanceOf(user2);
        vm.prank(user2);
        vault.withdraw(muPoolId, user2YBal);
        uint256 u2Payout = usdc.balanceOf(user2) - u2Before;

        // User2 deposited 4x more so gets ~4x payout
        assertGt(u2Payout, u1Payout * 3);

        // Pool fully drained
        (, , , uint64 rrAfter, , , ) = _getPoolData(muPoolId);
        assertEq(rrAfter, 0);
    }

    // ========================================================================
    // sweep_repay_vault
    // ========================================================================

    function test_sweep_rejectsBeforeWithdrawals() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));

        vm.prank(authority);
        vm.expectRevert(FixedVault.WithdrawalsNotEnabled.selector);
        vault.sweepRepayVault(swPoolId);
    }

    function test_sweep_rejectsBeforeGracePeriod() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(swPoolId);

        // Try sweep immediately → grace period not elapsed
        vm.prank(authority);
        vm.expectRevert(FixedVault.SweepGracePeriodNotElapsed.selector);
        vault.sweepRepayVault(swPoolId);
    }

    function test_sweep_successAfterGrace() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(swPoolId);

        // Warp past grace period (180 days)
        vm.warp(uint256(int256(shortMat)) + vault.SWEEP_GRACE_SECONDS());

        uint256 authBefore = usdc.balanceOf(authority);
        vm.prank(authority);
        vault.sweepRepayVault(swPoolId);
        uint256 authAfter = usdc.balanceOf(authority);

        assertGt(authAfter - authBefore, 0);

        (, , , uint64 rr, , , ) = _getPoolData(swPoolId);
        assertEq(rr, 0);
    }

    function test_sweep_rejectsNonAuthority() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(swPoolId);

        vm.warp(uint256(int256(shortMat)) + vault.SWEEP_GRACE_SECONDS());

        vm.prank(attacker);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.sweepRepayVault(swPoolId);
    }

    function test_sweep_rejectsNothingToSweep() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(swPoolId);

        // User withdraws everything
        vm.prank(user1);
        vault.withdraw(swPoolId, yBal);

        vm.warp(uint256(int256(shortMat)) + vault.SWEEP_GRACE_SECONDS());

        vm.prank(authority);
        vm.expectRevert(FixedVault.NothingToSweep.selector);
        vault.sweepRepayVault(swPoolId);
    }

    // ========================================================================
    // Events
    // ========================================================================

    function test_event_deposit() public {
        _initDefaultPool();

        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);

        vm.expectEmit(true, true, false, false);
        emit FixedVault.DepositEvent(POOL_ID, user1, 0, 0, 0, 0); // topic check only
        vault.deposit(POOL_ID, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_event_adminWithdraw() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.expectEmit(true, true, false, false);
        emit FixedVault.AdminWithdrawEvent(POOL_ID, authority, 0, 0, 0);
        vm.prank(authority);
        vault.adminWithdraw(POOL_ID, DEPOSIT_AMOUNT);
    }

    function test_event_repay() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.startPrank(authority);
        usdc.approve(address(vault), 500_000_000);
        vm.expectEmit(true, true, false, false);
        emit FixedVault.RepayEvent(POOL_ID, authority, 0, 0, 0, 0);
        vault.repay(POOL_ID, 500_000_000);
        vm.stopPrank();
    }

    function test_event_enableWithdrawals() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));

        vm.expectEmit(true, true, false, false);
        emit FixedVault.EnableWithdrawalsEvent(POOL_ID, authority, 0, 0, 0);
        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);
    }

    function test_event_withdraw() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(POOL_ID);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(POOL_ID, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(maturityTs)));
        vm.prank(authority);
        vault.enableWithdrawals(POOL_ID);

        vm.expectEmit(true, true, false, false);
        emit FixedVault.WithdrawEvent(POOL_ID, user1, 0, 0, 0, 0);
        vm.prank(user1);
        vault.withdraw(POOL_ID, yBal);
    }

    function test_event_poolInitialized() public {
        uint64 expectedPoolId = vault.nextPoolId();
        uint64 vaultNonce = vm.getNonce(address(vault));
        address yieldPred = vm.computeCreateAddress(address(vault), vaultNonce);

        vm.expectEmit(true, false, false, true);
        emit FixedVault.PoolInitialized(
            expectedPoolId,
            address(usdc),
            yieldPred,
            APR_BPS,
            maturityTs,
            uint64(0),
            MIN_DEPOSIT,
            MAX_TOTAL_DEPOSIT,
            false
        );

        vm.prank(authority);
        vault.initPool(
            FixedVault.InitPoolParams({
                depositToken: address(usdc),
                aprBps: APR_BPS,
                maturityTs: maturityTs,
                depositDeadlineOffset: 0,
                minDepositAmount: MIN_DEPOSIT,
                maxTotalDeposit: MAX_TOTAL_DEPOSIT,
                whitelistEnabled: false
            })
        );
    }

    function test_event_poolUpdated() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        uint64 newMax = 10_000_000_000;
        vm.startPrank(authority);
        vm.expectEmit(true, true, false, true);
        emit FixedVault.PoolUpdated(
            POOL_ID, authority, newMax, MIN_DEPOSIT, uint16(1200), false, block.timestamp
        );
        vault.updatePool(
            POOL_ID,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: true,
                maxTotalDeposit: newMax,
                updateMinDepositAmount: false,
                minDepositAmount: 0,
                updateAprBps: true,
                aprBps: 1200,
                updateAllowOverpay: false,
                allowOverpay: false
            })
        );
        vm.stopPrank();
    }

    function test_event_depositPermitGranted() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);
        int64 expiresAt = int64(int256(block.timestamp + 3600));
        uint64 maxAmt = 500_000_000;

        vm.prank(authority);
        vm.expectEmit(true, true, false, true);
        emit FixedVault.DepositPermitGranted(wlPoolId, user1, maxAmt, expiresAt);
        vault.grantPermit(wlPoolId, user1, maxAmt, expiresAt);
    }

    function test_event_depositPermitRevoked() public {
        uint64 wlPoolId = _initPool(APR_BPS, maturityTs, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, true);

        vm.prank(authority);
        vault.grantPermit(wlPoolId, user1, 0, 0);

        vm.prank(authority);
        vm.expectEmit(true, true, false, true);
        emit FixedVault.DepositPermitRevoked(wlPoolId, user1);
        vault.revokePermit(wlPoolId, user1);
    }

    function test_event_sweepRepayVault() public {
        int64 shortMat = int64(int256(block.timestamp + 3 days));
        uint64 swPoolId = _initPool(APR_BPS, shortMat, 0, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);
        _deposit(user1, swPoolId, DEPOSIT_AMOUNT);

        YieldToken yt = _getYieldToken(swPoolId);
        uint64 yBal = uint64(yt.balanceOf(user1));

        vm.startPrank(authority);
        usdc.approve(address(vault), yBal);
        vault.repay(swPoolId, yBal);
        vm.stopPrank();

        vm.warp(uint256(int256(shortMat)));
        vm.prank(authority);
        vault.enableWithdrawals(swPoolId);

        vm.warp(uint256(int256(shortMat)) + vault.SWEEP_GRACE_SECONDS());

        vm.prank(authority);
        vm.expectEmit(true, true, false, true);
        emit FixedVault.SweepRepayVaultEvent(swPoolId, authority, yBal, yBal, block.timestamp);
        vault.sweepRepayVault(swPoolId);
    }

    // ========================================================================
    // deposit_deadline_offset
    // ========================================================================

    function test_depositDeadline_rejectsAfterDeadline() public {
        // Maturity 90 days, deadline offset 1 day → deposits close 89 days from now
        uint64 ddPoolId = _initPool(APR_BPS, maturityTs, 86400, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);

        // Warp to after deadline (89 days + 1 second)
        vm.warp(uint256(int256(maturityTs)) - 86400 + 1);

        vm.startPrank(user1);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert(FixedVault.DepositDeadlinePassed.selector);
        vault.deposit(ddPoolId, DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_depositDeadline_acceptsBeforeDeadline() public {
        uint64 ddPoolId = _initPool(APR_BPS, maturityTs, 86400, MIN_DEPOSIT, MAX_TOTAL_DEPOSIT, false);

        // Still within deadline
        _deposit(user1, ddPoolId, DEPOSIT_AMOUNT);
        YieldToken yt = _getYieldToken(ddPoolId);
        assertGt(yt.balanceOf(user1), 0);
    }

    // ========================================================================
    // Constraint violations
    // ========================================================================

    function test_adminWithdraw_nonAuthority() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.prank(user1);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.adminWithdraw(POOL_ID, 1);
    }

    function test_repay_nonAuthority() public {
        _initDefaultPool();
        _deposit(user1, POOL_ID, DEPOSIT_AMOUNT);

        vm.prank(user1);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.repay(POOL_ID, 1);
    }

    function test_enableWithdrawals_nonAuthority() public {
        _initDefaultPool();
        vm.prank(user1);
        vm.expectRevert(FixedVault.Unauthorized.selector);
        vault.enableWithdrawals(POOL_ID);
    }

    // ========================================================================
    // Yield token checks
    // ========================================================================

    function test_yieldToken_properties() public {
        _initDefaultPool();

        YieldToken yt = _getYieldToken(POOL_ID);
        assertEq(yt.decimals(), 6); // same as USDC
        assertEq(yt.vault(), address(vault));
    }

    function test_yieldToken_onlyVaultCanMintBurn() public {
        _initDefaultPool();
        YieldToken yt = _getYieldToken(POOL_ID);

        vm.prank(attacker);
        vm.expectRevert(YieldToken.OnlyVault.selector);
        yt.mint(attacker, 1000);

        vm.prank(attacker);
        vm.expectRevert(YieldToken.OnlyVault.selector);
        yt.burn(attacker, 1000);
    }
}
