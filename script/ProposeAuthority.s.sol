// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Step 1 of 2: current authority proposes `NEW_AUTHORITY`. They must call AcceptAuthority next.
///
/// Environment variables:
/// - PRIVATE_KEY — current authority private key
/// - VAULT — FixedVault address
/// - NEW_AUTHORITY — address that will accept (becomes authority after accept)
contract ProposeAuthority is Script {
    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(key);
        address vaultAddr = vm.envAddress("VAULT");
        address newAuthority = vm.envAddress("NEW_AUTHORITY");

        console.log("Current sender (must be authority):", sender);
        console.log("Proposed new authority:", newAuthority);

        vm.startBroadcast(key);

        FixedVault(vaultAddr).proposeAuthority(newAuthority);

        vm.stopBroadcast();

        console.log("ProposeAuthority done; pending new authority must run AcceptAuthority.s.sol");
    }
}
