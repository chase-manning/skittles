export declare type address = string;
export declare type bytes = string;
export declare const self: address;
export declare class block {
    static get coinbase(): address;
    static get difficulty(): number;
    static get block(): number;
    static get prevhash(): number;
    static get timestamp(): number;
}
export declare class chain {
    static get id(): number;
}
export declare class msg {
    static get data(): string;
    static get sender(): address;
    static get value(): number;
}
export declare class tx {
    static get gasPrice(): number;
    static get origin(): address;
}
export interface SkittlesEvent<Type> {
    emit(data: Type): void;
}
export interface SkittlesConfig {
    typeCheck?: boolean;
    optimizer?: {
        enabled?: boolean;
        runs?: number;
        details?: {
            peephole?: boolean;
            inliner?: boolean;
            jumpdestRemover?: boolean;
            orderLiterals?: boolean;
            deduplicate?: boolean;
            cse?: boolean;
            constantOptimizer?: boolean;
            yul?: boolean;
            yulDetails?: {
                stackAllocation?: boolean;
                optimizerSteps?: string;
            };
        };
    };
}
export declare const hash: (...args: (number | address | boolean | bytes)[]) => bytes;
