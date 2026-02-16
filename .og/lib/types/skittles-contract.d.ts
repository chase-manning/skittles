import { SkittlesExpression } from "./skittles-expression";
import { SkittlesStatement } from "./skittles-statement";
import { SkittlesType } from "./skittles-type";
export interface SkittlesVariable {
    name: string;
    type: SkittlesType;
    value?: SkittlesExpression;
    private: boolean;
    immutable: boolean;
}
export interface SkittlesEventType {
    label: string;
    parameters: SkittlesParameter[];
}
export interface SkittlesParameter {
    name: string;
    type: SkittlesType;
}
export interface SkittlesValue {
    name: string;
    value: SkittlesExpression;
}
export interface SkittlesMethod {
    name: string;
    returns: SkittlesType;
    private: boolean;
    view: boolean;
    parameters: SkittlesParameter[];
    statements: SkittlesStatement[];
}
export interface SkittlesConstructor {
    parameters: SkittlesParameter[];
    statements: SkittlesStatement[];
}
export interface SkittlesInterface {
    name: string;
    elements: SkittlesParameter[];
}
export declare type SkittlesInterfaces = Record<string, SkittlesInterface>;
export declare type SkittlesConstants = Record<string, SkittlesExpression>;
interface SkittlesContract {
    extensions: string[];
    events: SkittlesEventType[];
    constants: SkittlesConstants;
    interfaces: SkittlesInterfaces;
    name: string;
    constructor?: SkittlesConstructor;
    variables: SkittlesVariable[];
    methods: SkittlesMethod[];
    functions: SkittlesMethod[];
}
export default SkittlesContract;
