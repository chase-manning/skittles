- Add support for default exports and imports of interfaces and update them
- Add support for default export and imports of contracts and update them
- Remove constructor from ERC20, and add a ERC20 wrapper just for testing
- Add support for multiple variable assignments at once
- Add ability to deploy contracts
- Fix issue with revert messages not showing
- add uniswap V2 implementation

=== UNISWAP V2 DONE ===

- Add config for things like running optimizer
- Add strict eslinting for typescript files and include in init and docs
- add init function
- add readme
- add normal repo things

=== CAN MAKE REPO PUBLIC ===

- change interface and constants dependency imports to only include the explicit imports
- Add support for `super()` and passing values to extended contracts
- Remove ignore logic
- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Performance improvements

==================================================================================================

=== IDEAS ===

- Extend everything from a contract class for things like `Contract.address` and stuff
- Change the tests to return actual contract types for the contract
- Change to the same output format as Hardhat
- Should events need to be store in the class? Maybe could import the object?

=== UNFORMATTED ===

- Change the build output to be a bit cleaner, don't output every file, maybe output it in a shared json, maybe make abi a `.json`, don't output `.yul`, add config for optionally exporting `.yul` or some other way to debug.
- The solc compiler can compile multiple contracts at once, it might be better to do that? https://www.npmjs.com/package/solc
- Add support for struct (or type) inputs for functions. e.g. `doThing(data: DataType)`
- Add support for passing event data through as an constant `const data: DataType = {meow: 2};` and `this.coolEvent.emit(data)`
- Add event indexing
- Add support for initialising an event inline
