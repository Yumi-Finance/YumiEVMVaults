// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Repays deposit tokens into a pool (authority only): approves `amount` then calls `repay`.
///
/// Environment variables:
/// - PRIVATE_KEY — authority private key
/// - VAULT — FixedVault address
/// - POOL_ID — pool id
/// - AMOUNT — repay amount in deposit token smallest units (must fit uint64)
contract RepayToPool is Script {
    function run() external {
        uint256 authorityKey = vm.envUint("PRIVATE_KEY");
        address authority = vm.addr(authorityKey);

        address vaultAddr = vm.envAddress("VAULT");

        uint256 poolId256 = vm.envUint("POOL_ID");
        require(poolId256 <= type(uint64).max, "POOL_ID too large");
        uint64 poolId = uint64(poolId256);

        uint256 amount256 = vm.envUint("AMOUNT");
        require(amount256 <= type(uint64).max, "AMOUNT too large");
        uint64 amount = uint64(amount256);

        FixedVault vault = FixedVault(vaultAddr);
        (, address depositToken, ,,,,,,,,,,,,,,,bool poolInitialized) = vault.pools(poolId);
        require(poolInitialized, "pool does not exist");

        console.log("Authority:", authority);
        console.log("Vault:", vaultAddr);
        console.log("Pool:", poolId);
        console.log("Repay amount:", amount);

        vm.startBroadcast(authorityKey);

        IERC20(depositToken).approve(vaultAddr, amount);
        vault.repay(poolId, amount);

        vm.stopBroadcast();

        console.log("Repay done");
    }
}

