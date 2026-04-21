// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FixedVault} from "../src/FixedVault.sol";

/// @notice Creates a pool on an already deployed `FixedVault`. Broadcasts with the authority key (same as vault deploy).
///
/// Environment variables:
/// - PRIVATE_KEY — authority private key
/// - VAULT — FixedVault address
/// - DEPOSIT_TOKEN — deposit ERC20
/// - APR_BPS — APR in basis points (e.g. 800 = 8%)
/// - MATURITY_OFFSET_SECONDS — seconds from `block.timestamp` until pool maturity
/// - DEPOSIT_DEADLINE_OFFSET — seconds before maturity after which deposits close; 0 = no early deadline
/// - MIN_DEPOSIT — minimum deposit (raw token units, uint64)
/// - MAX_TOTAL_DEPOSIT — pool cap (raw token units)
/// - WHITELIST_ENABLED — true/false
contract CreatePool is Script {
    function run() external returns (uint64 poolId) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address authority = vm.addr(deployerKey);

        address vaultAddr = vm.envAddress("VAULT");
        address depositToken = vm.envAddress("DEPOSIT_TOKEN");

        uint256 aprBps256 = vm.envUint("APR_BPS");
        require(aprBps256 <= type(uint16).max, "APR_BPS too large");
        uint16 aprBps = uint16(aprBps256);

        uint256 maturityOff = vm.envUint("MATURITY_OFFSET_SECONDS");
        int64 maturityTs = int64(int256(block.timestamp + maturityOff));

        uint256 ddo256 = vm.envOr("DEPOSIT_DEADLINE_OFFSET", uint256(0));
        require(ddo256 <= type(uint64).max, "DEPOSIT_DEADLINE_OFFSET too large");
        uint64 depositDeadlineOffset = uint64(ddo256);

        uint256 minDep256 = vm.envUint("MIN_DEPOSIT");
        require(minDep256 <= type(uint64).max, "MIN_DEPOSIT too large");
        uint64 minDepositAmount = uint64(minDep256);

        uint256 maxTot256 = vm.envUint("MAX_TOTAL_DEPOSIT");
        require(maxTot256 <= type(uint64).max, "MAX_TOTAL_DEPOSIT too large");
        uint64 maxTotalDeposit = uint64(maxTot256);

        bool whitelistEnabled = vm.envOr("WHITELIST_ENABLED", false);

        console.log("Authority:", authority);
        console.log("Vault:", vaultAddr);

        vm.startBroadcast(deployerKey);

        poolId = FixedVault(vaultAddr).initPool(
            FixedVault.InitPoolParams({
                depositToken: depositToken,
                aprBps: aprBps,
                maturityTs: maturityTs,
                depositDeadlineOffset: depositDeadlineOffset,
                minDepositAmount: minDepositAmount,
                maxTotalDeposit: maxTotalDeposit,
                whitelistEnabled: whitelistEnabled
            })
        );

        vm.stopBroadcast();

        console.log("Pool ID:", poolId);
        (
            uint64 _poolId,
            address _depositToken,
            address yieldToken,
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
        ) = FixedVault(vaultAddr).pools(poolId);
        console.log("Yield token:", yieldToken);
    }
}
