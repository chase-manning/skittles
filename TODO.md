- Cleanup `extractConditionalExpressionStatements` function so it doesn't have duplicate function calls
- Handle Handle expressions within expressions in the `extractConditionalExpressions` functions
- Add option to clear cache for when testing
- Add tests for all types of conditional statements
- Add tests for other variable types of conditional statements (e.g. strings)
- Add support for events
- Add support for multiple variable assignments at once
- Add ability to deploy contracts
- Fix issue with revert messages not showing
- add uniswap V2 implementation

=== UNISWAP V2 DONE ===

- Include dependencies in cache refresh
- Add config for things like running optimizer
- Add strict eslinting for typescript files and include in init and docs
- add init function
- add readme
- add normal repo things

=== CAN MAKE REPO PUBLIC ===

- Add support for `super()` and passing values to extended contracts
- Remove ignore logic
- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Performance improvements

==================================================================================================

=== IDEAS ===

- Extend everything from a contract class for things like `Contract.address` and stuff
- Change the tests to return actual contract types for the contract
- Change to the same output format as Hardhat

=== UNFORMATTED ===

- Change the build output to be a bit cleaner, don't output every file, maybe output it in a shared json, maybe make abi a `.json`, don't output `.yul`, add config for optionally exporting `.yul` or some other way to debug.
- The solc compiler can compile multiple contracts at once, it might be better to do that? https://www.npmjs.com/package/solc
