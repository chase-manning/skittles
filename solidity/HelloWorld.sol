// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.15;

contract HelloWorld {
    uint256 public balance;

    function add(uint256 value) public returns (uint256) {
        balance = balance + value;
        return balance;
    }
}
