// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Step 2 of 2: pending authority accepts and becomes authority.
///
/// Environment variables:
/// - PRIVATE_KEY — must be the `NEW_AUTHORITY` address from ProposeAuthority
/// - VAULT — FixedVault address
contract AcceptAuthority is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(key);
        address vaultAddr = vm.envAddress("VAULT");

        FixedVault vault = FixedVault(vaultAddr);
        address pending = vault.pendingAuthority();

        require(pending != address(0), "no pending authority");
        require(sender == pending, "PRIVATE_KEY must match pending authority");

        console.log("Accepting as:", sender);

        vm.startBroadcast(key);

        vault.acceptAuthority();

        vm.stopBroadcast();

        console.log("Authority transferred to:", vault.authority());
    }
}
