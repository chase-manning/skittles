- Setup Hello World as a full regression test
- Move formatting to separate step
- Test overflow and underflow protection

====== Code Phase 1 Complete =====

- We can remove lib from source control right?
- Split up code more
- Extract all TODO comments to here

===== Peer Review ====

- Consider making types default exports (like `string` and `number` are)
- wrap all hardhat functions
- add init function
- add readme
- add normal repo things

==== Beta ready ====

- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Consider how we handle large numbers (BigNumber or something?)
- automatic mapping views
- Add config for things like running optimizer

==== FORMATTED ====

- Remove redundant stores for `readonly` values in the constructor
