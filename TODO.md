===== Peer Review ====

- add init function
- add readme
- add normal repo things

==== Beta ready ====

- Add support for `else` conditions for `if` statements (need to use switches)
- Add support for events
- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Consider how we handle large numbers (BigNumber or something?)
- automatic mapping views
- Add config for things like running optimizer

==== FORMATTED ====

- Change to the same output format as Hardhat
- Add smarter compiling with cache and only update chagned contracts
- Remove redundant stores for `readonly` values in the constructor
- Performance improvements
- Change to getting function signatures with this: https://github.com/FuelLabs/yulp/blob/620d04acb060a7a817e2cfc6da4c9b4d9c7fcef0/src/yulplus.ne#L40
