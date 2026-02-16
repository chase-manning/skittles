// ============================================================
// Config
// ============================================================

export interface SkittlesConfig {
  typeCheck?: boolean;
  optimizer?: OptimizerConfig;
  contractsDir?: string;
  outputDir?: string;
}

export interface OptimizerConfig {
  enabled?: boolean;
  runs?: number;
}

// ============================================================
// Contract IR
// ============================================================

export interface SkittlesContract {
  name: string;
  sourcePath: string;
  variables: SkittlesVariable[];
  functions: SkittlesFunction[];
  events: SkittlesEvent[];
  ctor?: SkittlesConstructor;
  inherits: string[];
}

export interface SkittlesVariable {
  name: string;
  type: SkittlesType;
  visibility: Visibility;
  immutable: boolean;
  initialValue?: Expression;
}

export interface SkittlesFunction {
  name: string;
  parameters: SkittlesParameter[];
  returnType: SkittlesType | null;
  visibility: Visibility;
  stateMutability: StateMutability;
  body: Statement[];
}

export interface SkittlesConstructor {
  parameters: SkittlesParameter[];
  body: Statement[];
}

export interface SkittlesEvent {
  name: string;
  parameters: SkittlesParameter[];
}

export interface SkittlesParameter {
  name: string;
  type: SkittlesType;
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
  Void = "void",
}

export interface SkittlesType {
  kind: SkittlesTypeKind;
  keyType?: SkittlesType;
  valueType?: SkittlesType;
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
  | RevertStatement
  | EmitStatement;

export interface ReturnStatement {
  kind: "return";
  value?: Expression;
}

export interface VariableDeclarationStatement {
  kind: "variable-declaration";
  name: string;
  type?: SkittlesType;
  initializer?: Expression;
}

export interface ExpressionStatement {
  kind: "expression";
  expression: Expression;
}

export interface IfStatement {
  kind: "if";
  condition: Expression;
  thenBody: Statement[];
  elseBody?: Statement[];
}

export interface ForStatement {
  kind: "for";
  initializer?: VariableDeclarationStatement | ExpressionStatement;
  condition?: Expression;
  incrementor?: Expression;
  body: Statement[];
}

export interface WhileStatement {
  kind: "while";
  condition: Expression;
  body: Statement[];
}

export interface RevertStatement {
  kind: "revert";
  message?: Expression;
}

export interface EmitStatement {
  kind: "emit";
  eventName: string;
  args: Expression[];
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
  | NewExpression;

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

// ============================================================
// Build artifacts
// ============================================================

export interface BuildArtifact {
  contractName: string;
  abi: AbiItem[];
  bytecode: string;
  solidity: string;
}

export interface AbiItem {
  type: "function" | "event" | "constructor" | "fallback" | "receive";
  name?: string;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: string;
  anonymous?: boolean;
}

export interface AbiParameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParameter[];
}

// ============================================================
// Cache
// ============================================================

export interface CompilationCache {
  version: string;
  files: Record<string, CachedFile>;
}

export interface CachedFile {
  hash: string;
  dependencies: string[];
  lastCompiled: number;
}

// ============================================================
// User contract types (exported for contract authors)
// ============================================================

export type address = string;
export type bytes = string;
export type SkittlesEventType<T extends Record<string, unknown>> = T & {
  __event: true;
};
