// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";
import {YieldToken} from "../src/YieldToken.sol";

/// @notice Burns yTokens and receives deposit tokens after maturity and once withdrawals are enabled.
///
/// Environment variables:
/// - USER_PRIVATE_KEY — holder of yTokens (same address receives payout)
/// - VAULT — FixedVault address
/// - POOL_ID — pool id
/// - AMOUNT — yToken amount to burn (must fit uint64; use full balance to exit entirely)
contract WithdrawFromPool is Script {
    function run() external {
        uint256 userKey = vm.envUint("USER_PRIVATE_KEY");
        address user = vm.addr(userKey);

        address vaultAddr = vm.envAddress("VAULT");
        uint256 poolId256 = vm.envUint("POOL_ID");
        require(poolId256 <= type(uint64).max, "POOL_ID too large");
        uint64 poolId = uint64(poolId256);

        uint256 amount256 = vm.envUint("AMOUNT");
        require(amount256 <= type(uint64).max, "AMOUNT too large");
        uint64 amount = uint64(amount256);

        FixedVault vault = FixedVault(vaultAddr);
        (, address depositToken, address yieldToken,,,,,,,,,,,,,,) = vault.pools(poolId);
        require(depositToken != address(0), "pool does not exist");

        uint256 ytBal = YieldToken(yieldToken).balanceOf(user);
        console.log("User:", user);
        console.log("Pool:", poolId);
        console.log("yToken balance:", ytBal);
        console.log("Withdraw (yToken amount):", amount);

        vm.startBroadcast(userKey);

        vault.withdraw(poolId, amount);

        vm.stopBroadcast();

        console.log("Withdraw done");
    }
}
