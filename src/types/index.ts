// ============================================================
// Config
// ============================================================

export interface SkittlesConfig {
  typeCheck?: boolean;
  optimizer?: OptimizerConfig;
  contractsDir?: string;
  outputDir?: string;
  cacheDir?: string;
}

export interface OptimizerConfig {
  enabled?: boolean;
  runs?: number;
}

// ============================================================
// Contract IR
// ============================================================

export interface SkittlesStruct {
  name: string;
  fields: SkittlesParameter[];
}

export interface SkittlesInterfaceFunction {
  name: string;
  parameters: SkittlesParameter[];
  returnType: SkittlesType | null;
  stateMutability?: StateMutability;
}

export interface SkittlesContractInterface {
  name: string;
  functions: SkittlesInterfaceFunction[];
}

export interface SkittlesEnum {
  name: string;
  members: string[];
}

export interface SkittlesCustomError {
  name: string;
  parameters: SkittlesParameter[];
}

export interface SkittlesContract {
  name: string;
  sourcePath: string;
  variables: SkittlesVariable[];
  functions: SkittlesFunction[];
  events: SkittlesEvent[];
  structs: SkittlesStruct[];
  enums: SkittlesEnum[];
  contractInterfaces: SkittlesContractInterface[];
  customErrors: SkittlesCustomError[];
  ctor?: SkittlesConstructor;
  inherits: string[];
  sourceLine?: number;
}

export interface SkittlesVariable {
  name: string;
  type: SkittlesType;
  visibility: Visibility;
  immutable: boolean;
  constant: boolean;
  isOverride?: boolean;
  initialValue?: Expression;
  sourceLine?: number;
}

export interface SkittlesFunction {
  name: string;
  parameters: SkittlesParameter[];
  returnType: SkittlesType | null;
  visibility: Visibility;
  stateMutability: StateMutability;
  isVirtual: boolean;
  isOverride: boolean;
  body: Statement[];
  sourceLine?: number;
}

export interface SkittlesConstructor {
  parameters: SkittlesParameter[];
  body: Statement[];
  sourceLine?: number;
}

export interface SkittlesEvent {
  name: string;
  parameters: SkittlesParameter[];
  sourceLine?: number;
}

export interface SkittlesParameter {
  name: string;
  type: SkittlesType;
  indexed?: boolean;
  defaultValue?: Expression;
}

// ============================================================
// Type system
// ============================================================

export enum SkittlesTypeKind {
  Uint256 = "uint256",
  Int256 = "int256",
  Address = "address",
  Bool = "bool",
  String = "string",
  Bytes32 = "bytes32",
  Bytes = "bytes",
  Mapping = "mapping",
  Array = "array",
  Struct = "struct",
  ContractInterface = "contract-interface",
  Enum = "enum",
  Tuple = "tuple",
  Void = "void",
}

export interface SkittlesType {
  kind: SkittlesTypeKind;
  keyType?: SkittlesType;
  valueType?: SkittlesType;
  structName?: string;
  structFields?: SkittlesParameter[];
  tupleTypes?: SkittlesType[];
}

export type Visibility = "public" | "private" | "internal" | "external";

export type StateMutability = "pure" | "view" | "nonpayable" | "payable";

// ============================================================
// Statements
// ============================================================

export type Statement =
  | ReturnStatement
  | VariableDeclarationStatement
  | ExpressionStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | DoWhileStatement
  | BreakStatement
  | ContinueStatement
  | RevertStatement
  | EmitStatement
  | SwitchStatement
  | DeleteStatement
  | TryCatchStatement;

export interface ReturnStatement {
  kind: "return";
  value?: Expression;
  sourceLine?: number;
}

export interface VariableDeclarationStatement {
  kind: "variable-declaration";
  name: string;
  type?: SkittlesType;
  initializer?: Expression;
  sourceLine?: number;
}

export interface ExpressionStatement {
  kind: "expression";
  expression: Expression;
  sourceLine?: number;
}

export interface IfStatement {
  kind: "if";
  condition: Expression;
  thenBody: Statement[];
  elseBody?: Statement[];
  sourceLine?: number;
}

export interface ForStatement {
  kind: "for";
  initializer?: VariableDeclarationStatement | ExpressionStatement;
  condition?: Expression;
  incrementor?: Expression;
  body: Statement[];
  sourceLine?: number;
}

export interface WhileStatement {
  kind: "while";
  condition: Expression;
  body: Statement[];
  sourceLine?: number;
}

export interface DoWhileStatement {
  kind: "do-while";
  condition: Expression;
  body: Statement[];
  sourceLine?: number;
}

export interface BreakStatement {
  kind: "break";
  sourceLine?: number;
}

export interface ContinueStatement {
  kind: "continue";
  sourceLine?: number;
}

export interface RevertStatement {
  kind: "revert";
  message?: Expression;
  customError?: string;
  customErrorArgs?: Expression[];
  sourceLine?: number;
}

export interface EmitStatement {
  kind: "emit";
  eventName: string;
  args: Expression[];
  sourceLine?: number;
}

export interface DeleteStatement {
  kind: "delete";
  target: Expression;
  sourceLine?: number;
}

export interface TryCatchStatement {
  kind: "try-catch";
  call: Expression;
  returnVarName?: string;
  returnType?: SkittlesType;
  successBody: Statement[];
  catchBody: Statement[];
}

export interface SwitchCase {
  value?: Expression; // undefined means default case
  body: Statement[];
}

export interface SwitchStatement {
  kind: "switch";
  discriminant: Expression;
  cases: SwitchCase[];
  sourceLine?: number;
}

// ============================================================
// Expressions
// ============================================================

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | Identifier
  | PropertyAccessExpression
  | ElementAccessExpression
  | BinaryExpression
  | UnaryExpression
  | AssignmentExpression
  | CallExpression
  | ConditionalExpression
  | NewExpression
  | ObjectLiteralExpression
  | TupleLiteralExpression;

export interface NumberLiteral {
  kind: "number-literal";
  value: string;
}

export interface StringLiteral {
  kind: "string-literal";
  value: string;
}

export interface BooleanLiteral {
  kind: "boolean-literal";
  value: boolean;
}

export interface Identifier {
  kind: "identifier";
  name: string;
}

export interface PropertyAccessExpression {
  kind: "property-access";
  object: Expression;
  property: string;
}

export interface ElementAccessExpression {
  kind: "element-access";
  object: Expression;
  index: Expression;
}

export interface BinaryExpression {
  kind: "binary";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  kind: "unary";
  operator: string;
  operand: Expression;
  prefix: boolean;
}

export interface AssignmentExpression {
  kind: "assignment";
  operator: string;
  target: Expression;
  value: Expression;
}

export interface CallExpression {
  kind: "call";
  callee: Expression;
  args: Expression[];
  typeArgs?: SkittlesType[];
}

export interface ConditionalExpression {
  kind: "conditional";
  condition: Expression;
  whenTrue: Expression;
  whenFalse: Expression;
}

export interface NewExpression {
  kind: "new";
  callee: string;
  args: Expression[];
}

export interface ObjectLiteralExpression {
  kind: "object-literal";
  properties: { name: string; value: Expression }[];
}

export interface TupleLiteralExpression {
  kind: "tuple-literal";
  elements: Expression[];
}

// ============================================================
// Build artifacts
// ============================================================

export interface SourceMapping {
  sourceFile: string;
  mappings: Record<number, number>; // solLine (1-based) -> tsLine (1-based)
}

export interface BuildArtifact {
  contractName: string;
  solidity: string;
  sourceMap?: SourceMapping;
}

export interface AbiItem {
  type: "function" | "event" | "constructor" | "fallback" | "receive";
  name?: string;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: StateMutability;
  anonymous?: boolean;
}

export interface AbiParameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParameter[];
}

// ============================================================
// User contract types (exported for contract authors)
// ============================================================

export type address = string;
export type bytes = string;
