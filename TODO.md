===== Peer Review ====

- add uniswap V2 implementation
- add init function
- add readme
- add normal repo things

==== Beta ready ====

- Add support for events
- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Add config for things like running optimizer

==== FORMATTED ====

- Change the tests to return actual contract types for the contract
- Change to the same output format as Hardhat
- Add smarter compiling with cache and only update chagned contracts
- Remove redundant stores for `readonly` values in the constructor
- Performance improvements
- Change to getting function signatures with this: https://github.com/FuelLabs/yulp/blob/620d04acb060a7a817e2cfc6da4c9b4d9c7fcef0/src/yulplus.ne#L40
- Add support for safeMul https://github.com/Uniswap/v2-core/blob/master/contracts/libraries/SafeMath.sol#L14
- Add strict eslinting for typescript files and include in init and docs
- use web workers for concurrency:
  - https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
  - https://github.com/mdn/dom-examples/tree/main/web-workers/simple-web-worker
- reaname SkittlesClass to Contract?
- remove the Skittles prefix on all types
- support files with no classes
- support files with two classes
