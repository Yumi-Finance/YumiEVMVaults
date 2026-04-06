// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title YieldToken
/// @notice ERC-20 yield token minted 1-per-pool by FixedVault.
///         Only the vault (owner) can mint and burn.
contract YieldToken is ERC20 {
    address public immutable vault;

    error OnlyVault();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address vault_
    ) ERC20(name_, symbol_) {
        vault = vault_;
        _decimals = decimals_;
    }

    uint8 private immutable _decimals;

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
