- Add ability to deploy contracts
- Add ability to deploy contract with constructor and params
- Add check that deploy was successful (returns 0 when fails, probably need to move logic into a deploy function and call that)
- Implement `SkittlesContract` `balance`
- Add support for getting an addresses `Account`
- Change compile to only compile contracts that extend `SkittlesContract`
- Order all the unformatted tassk
- Fix issue with revert messages not showing
- add uniswap V2 implementation

=== UNISWAP V2 DONE ===

- Add eslinting for package and general code styling improvements
- Add strict eslinting for typescript files and include in init and docs
- add init function
- add readme
- add normal repo things
- change exports to have sub directorys, e.g. `skittles/constants` or `skittles/config`

=== CAN MAKE REPO PUBLIC ===

- change interface and constants dependency imports to only include the explicit imports
- Add support for `super()` and passing values to extended contracts
- Remove ignore logic
- Add immutable (readonly) setting for evaluated values using `setimmutable`
- Performance improvements

==================================================================================================

=== IDEAS ===

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
- Cleanup get-file-data (Change so always using the same var, move stuff into new functions, remove dependency adding duplications)
- Add support for hashing strings
- Add support for `create2` opcode, and change `UniswapV2Factory` to use this with the token salts https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Factory.sol#L29
- Implement `SkittlesContract` `code`
- Implement `SkittlesContract` `codehash`
- Implement `SkittlesContract` `transfer`
- Implement `SkittlesContract` `send`
- Implement `SkittlesContract` `call`
- Implement `SkittlesContract` `delegatecall`
- Implement `SkittlesContract` `staticcall`
- Add natspec comments for all the core types
- Add support for sending Wei when deploying contract
- Refacor these `x = y ? j : l` to instead just be a function call, that way we don't need to iterate through everything and extract stuff.
- Fix issue with memory collisions using `mstore(x)` from sub functions
- Remove the duplication in yul template with constructor and normal versions of everything and having to add them twice
