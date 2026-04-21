// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Deposits into a pool: approves `amount` then calls `deposit`. Key is the token holder (not necessarily authority).
///
/// Environment variables:
/// - PRIVATE_KEY — depositor private key
/// - VAULT — FixedVault address
/// - POOL_ID — pool id
/// - AMOUNT — amount in token smallest units (must fit uint64)
contract DepositToPool is Script {
    function run() external {
        uint256 userKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(userKey);

        address vaultAddr = vm.envAddress("VAULT");
        uint256 poolId256 = vm.envUint("POOL_ID");
        require(poolId256 <= type(uint64).max, "POOL_ID too large");
        uint64 poolId = uint64(poolId256);

        uint256 amount256 = vm.envUint("AMOUNT");
        require(amount256 <= type(uint64).max, "AMOUNT too large");
        uint64 amount = uint64(amount256);

        FixedVault vault = FixedVault(vaultAddr);
        (
            uint64 _poolId,
            address depositToken,
            address _yieldToken,
            uint16 _aprBps,
            int64 _maturityTs,
            uint64 _depositDeadlineOffset,
            uint64 _minDepositAmount,
            uint64 _maxTotalDeposit,
            uint64 _totalDeposited,
            uint64 _totalExpectedReturn,
            uint64 _totalRepaid,
            uint64 _remainingRepay,
            uint64 _totalAdminWithdrawn,
            uint64 _totalSwept,
            bool _withdrawalsEnabled,
            bool _whitelistEnabled,
            bool _allowOverpay
        ) = vault.pools(poolId);
        require(depositToken != address(0), "pool does not exist");

        console.log("Depositor:", user);
        console.log("Pool:", poolId);
        console.log("Amount:", amount);

        vm.startBroadcast(userKey);

        IERC20 token = IERC20(depositToken);
        token.approve(vaultAddr, amount);
        vault.deposit(poolId, amount);

        vm.stopBroadcast();

        console.log("Deposit done");
    }
}
