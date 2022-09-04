- For lists, add check that you're not adding a value over the max length
- reaname SkittlesClass to Contract?
- remove the Skittles prefix on all types
- Split up `getSkittlesStatement` steps
- Lots of duplication in `getSkittlesStatement` expression statement handling
- Split up skittles class
- change all the constructor yuls to be like the neat functions one
- Add ability to extend interfaces
- Add support for events
- Add support for using impored variables (e.g. `ZERO_ADDRESS`)
- Add suppor for conditional expressions `a ? b : c`
- Add support for multiple variable assignments at once
- Add ability to deploy contracts
- Fix issue with revert messages not showing
- add uniswap V2 implementation

=== UNISWAP V2 DONE ===

- Add support for safeMul https://github.com/Uniswap/v2-core/blob/master/contracts/libraries/SafeMath.sol#L14
- Add config for things like running optimizer
- Add smarter compiling with cache and only update chagned contracts
- Add strict eslinting for typescript files and include in init and docs
- add init function
- add readme
- add normal repo things
- Clean up the way we're testing for reverts
- Fix annoying issue with some Javascript showing

=== CAN MAKE REPO PUBLIC ===

- support files with no classes
- support files with two classes
- Change to getting function signatures with this: https://github.com/FuelLabs/yulp/blob/620d04acb060a7a817e2cfc6da4c9b4d9c7fcef0/src/yulplus.ne#L40
- Performance improvements
- use web workers for concurrency:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
  - https://github.com/mdn/dom-examples/tree/main/web-workers/simple-web-worker
- Add immutable (readonly) setting for evaluated values using `setimmutable`

==================================================================================================

=== IDEAS ===

- Change the tests to return actual contract types for the contract
- Change to the same output format as Hardhat

=== UNFORMATTED ===
