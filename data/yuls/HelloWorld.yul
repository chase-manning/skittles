
object "HelloWorld" {
    code {
        // Deploy the contract
        datacopy(0, dataoffset("runtime"), datasize("runtime"))
        return(0, datasize("runtime"))
    }
    object "runtime" {
        code {
            /* ---------- dispatcher ----------- */
            switch selector()
            case 0x70a08231 /* "balance()" */ {
                returnUint(balanceStorage())
            }
            case 0x70a08232 /* "addBalance(uint256)" */ {
                addBalance(decodeAsUint(0))
            }
            default {
                revert(0, 0)
            }


            /* ---------- calldata decoding functions ----------- */
            function selector() -> s {
                s := div(calldataload(0), 0x100000000000000000000000000000000000000000000000000000000)
            }
            function decodeAsUint(offset) -> v {
                let pos := add(4, mul(offset, 0x20))
                if lt(calldatasize(), add(pos, 0x20)) {
                    revert(0, 0)
                }
                v := calldataload(pos)
            }


            /* ---------- calldata encoding functions ---------- */
            function returnUint(v) {
                mstore(0, v)
                return(0, 0x20)
            }


            /* -------- storage layout ---------- */
            function balancePos() -> p { p := 0 }


            /* -------- storage access ---------- */
            function balanceStorage() -> b {
                b := sload(balancePos())
            }
            function addBalance(value) {
                sstore(balancePos(), safeAdd(balanceStorage(), value))
            }


            /* ---------- utility functions ---------- */
            function safeAdd(a, b) -> r {
                r := add(a, b)
                if or(lt(r, a), lt(r, b)) { revert(0, 0) }
            }
        }
    }
}
