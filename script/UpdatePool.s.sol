// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Updates pool parameters (authority only). Each field is applied only if its UPDATE_* flag is true.
///
/// Environment variables:
/// - PRIVATE_KEY — authority private key
/// - VAULT — FixedVault address
/// - POOL_ID — pool id
///
/// Optional update flags and values:
/// - UPDATE_MAX_TOTAL_DEPOSIT (true/false) + NEW_MAX_TOTAL_DEPOSIT (uint64)
/// - UPDATE_MIN_DEPOSIT (true/false) + NEW_MIN_DEPOSIT (uint64)
/// - UPDATE_APR_BPS (true/false) + NEW_APR_BPS (uint16, basis points)
/// - UPDATE_ALLOW_OVERPAY (true/false) + NEW_ALLOW_OVERPAY (true/false)
contract UpdatePool is Script {
    function run() external {
        uint256 authorityKey = vm.envUint("PRIVATE_KEY");
        address authority = vm.addr(authorityKey);

        address vaultAddr = vm.envAddress("VAULT");

        uint256 poolId256 = vm.envUint("POOL_ID");
        require(poolId256 <= type(uint64).max, "POOL_ID too large");
        uint64 poolId = uint64(poolId256);

        bool updateMaxTotalDeposit = vm.envOr("UPDATE_MAX_TOTAL_DEPOSIT", false);
        bool updateMinDepositAmount = vm.envOr("UPDATE_MIN_DEPOSIT", false);
        bool updateAprBps = vm.envOr("UPDATE_APR_BPS", false);
        bool updateAllowOverpay = vm.envOr("UPDATE_ALLOW_OVERPAY", false);

        uint64 newMaxTotalDeposit = 0;
        if (updateMaxTotalDeposit) {
            uint256 v = vm.envUint("NEW_MAX_TOTAL_DEPOSIT");
            require(v <= type(uint64).max, "NEW_MAX_TOTAL_DEPOSIT too large");
            newMaxTotalDeposit = uint64(v);
        }

        uint64 newMinDepositAmount = 0;
        if (updateMinDepositAmount) {
            uint256 v = vm.envUint("NEW_MIN_DEPOSIT");
            require(v <= type(uint64).max, "NEW_MIN_DEPOSIT too large");
            newMinDepositAmount = uint64(v);
        }

        uint16 newAprBps = 0;
        if (updateAprBps) {
            uint256 v = vm.envUint("NEW_APR_BPS");
            require(v <= type(uint16).max, "NEW_APR_BPS too large");
            newAprBps = uint16(v);
        }

        bool newAllowOverpay = false;
        if (updateAllowOverpay) {
            newAllowOverpay = vm.envBool("NEW_ALLOW_OVERPAY");
        }

        console.log("Authority:", authority);
        console.log("Vault:", vaultAddr);
        console.log("Pool:", poolId);
        console.log("updateMaxTotalDeposit:", updateMaxTotalDeposit);
        console.log("updateMinDepositAmount:", updateMinDepositAmount);
        console.log("updateAprBps:", updateAprBps);
        console.log("updateAllowOverpay:", updateAllowOverpay);

        vm.startBroadcast(authorityKey);

        FixedVault(vaultAddr).updatePool(
            poolId,
            FixedVault.UpdatePoolParams({
                updateMaxTotalDeposit: updateMaxTotalDeposit,
                maxTotalDeposit: newMaxTotalDeposit,
                updateMinDepositAmount: updateMinDepositAmount,
                minDepositAmount: newMinDepositAmount,
                updateAprBps: updateAprBps,
                aprBps: newAprBps,
                updateAllowOverpay: updateAllowOverpay,
                allowOverpay: newAllowOverpay
            })
        );

        vm.stopBroadcast();

        console.log("UpdatePool done");
    }
}

