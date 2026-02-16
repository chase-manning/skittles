"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERC20 = void 0;
const core_types_1 = require("skittles/lib/types/core-types");
/**
 * A simple ERC20 token implementation in Skittles.
 * This demonstrates a more complex contract with events and mappings.
 */
class ERC20 {
    constructor(initialSupply) {
        this.decimals = 18;
        this.symbol = "TOKEN";
        this.name = "My Token";
        this.totalSupply = initialSupply;
        this.balanceOf[core_types_1.msg.sender] = initialSupply;
    }
    approve(spender, amount) {
        this.allowance[core_types_1.msg.sender][spender] = amount;
        this.Approval.emit({ owner: core_types_1.msg.sender, spender, amount });
        return true;
    }
    transfer(to, amount) {
        this._transfer(core_types_1.msg.sender, to, amount);
        return true;
    }
    transferFrom(from, to, amount) {
        if (this.allowance[from][core_types_1.msg.sender] !== Number.MAX_VALUE) {
            this.allowance[from][core_types_1.msg.sender] -= amount;
        }
        this._transfer(from, to, amount);
        return true;
    }
    _transfer(from, to, amount) {
        this.balanceOf[to] += amount;
        this.balanceOf[from] -= amount;
        this.Transfer.emit({ from, to, amount });
    }
}
exports.ERC20 = ERC20;
