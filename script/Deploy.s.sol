// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("Balance: ", deployer.balance);

        vm.startBroadcast(deployerKey);

        FixedVault vault = new FixedVault(deployer);

        vm.stopBroadcast();

        console.log("FixedVault deployed at:", address(vault));
    }
}
