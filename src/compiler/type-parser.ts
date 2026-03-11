import ts from "typescript";
import { ADDRESS_LITERAL_RE } from "../types/index.ts";
import type {
  SkittlesParameter,
  SkittlesType,
  SkittlesTypeKind,
  Expression,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import { STRING_RETURNING_HELPERS } from "./parser-utils.ts";

export function parseTypeLiteralFields(node: ts.TypeLiteralNode): SkittlesParameter[] {
  const fields: SkittlesParameter[] = [];
  for (const member of node.members) {
    if (
      ts.isPropertySignature(member) &&
      member.name &&
      ts.isIdentifier(member.name)
    ) {
      const name = member.name.text;
      const type: SkittlesType = member.type
        ? parseType(member.type)
        : { kind: "uint256" as SkittlesTypeKind };
      fields.push({ name, type });
    }
  }
  return fields;
}

export function parseType(node: ts.TypeNode): SkittlesType {
  if (ts.isTypePredicateNode(node)) {
    if (node.assertsModifier) {
      throw new Error(
        "Skittles does not support 'asserts' type predicates (e.g. 'asserts x is T' or 'asserts condition'). " +
          "These are not boolean-returning in TypeScript and cannot be compiled. " +
          "Please remove the 'asserts' modifier or refactor this function."
      );
    }
    return { kind: "bool" as SkittlesTypeKind };
  }

  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName)
      ? node.typeName.text
      : "";

    if (
      (name === "Record" || name === "Map") &&
      node.typeArguments &&
      node.typeArguments.length === 2
    ) {
      return {
        kind: "mapping" as SkittlesTypeKind,
        keyType: parseType(node.typeArguments[0]),
        valueType: parseType(node.typeArguments[1]),
      };
    }

    if (
      name === "ReadonlyArray" &&
      node.typeArguments &&
      node.typeArguments.length === 1
    ) {
      return {
        kind: "array" as SkittlesTypeKind,
        valueType: parseType(node.typeArguments[0]),
      };
    }

    if (name === "address") return { kind: "address" as SkittlesTypeKind };
    if (name === "bytes") return { kind: "bytes" as SkittlesTypeKind };
    if (name === "bytes32") return { kind: "bytes32" as SkittlesTypeKind };

    if (ctx.knownStructs.has(name)) {
      return {
        kind: "struct" as SkittlesTypeKind,
        structName: name,
        structFields: ctx.knownStructs.get(name),
      };
    }

    if (ctx.knownContractInterfaces.has(name)) {
      return {
        kind: "contract-interface" as SkittlesTypeKind,
        structName: name,
      };
    }

    if (ctx.knownEnums.has(name)) {
      return {
        kind: "enum" as SkittlesTypeKind,
        structName: name,
      };
    }

    throw new Error(`Unsupported type reference: "${name}". Skittles supports number, string, boolean, address, bytes, bytes32, Record<K,V>, T[], type structs, interfaces, and enums.`);
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "array" as SkittlesTypeKind,
      valueType: parseType(node.elementType),
    };
  }

  if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) {
    return parseType(node.type);
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: "tuple" as SkittlesTypeKind,
      tupleTypes: node.elements.map((el) => {
        if (ts.isNamedTupleMember(el)) {
          return parseType(el.type);
        }
        return parseType(el as ts.TypeNode);
      }),
    };
  }

  switch (node.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "uint256" as SkittlesTypeKind };
    case ts.SyntaxKind.StringKeyword:
      return { kind: "string" as SkittlesTypeKind };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "bool" as SkittlesTypeKind };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "void" as SkittlesTypeKind };
    default:
      throw new Error(`Unsupported type node kind: ${ts.SyntaxKind[node.kind]}. Skittles supports number, string, boolean, address, bytes, bytes32, Record<K,V>, and T[].`);
  }
}

export function inferType(
  expr: Expression,
  varTypes: Map<string, SkittlesType>
): SkittlesType | undefined {
  switch (expr.kind) {
    case "number-literal":
      return { kind: "uint256" as SkittlesTypeKind };
    case "string-literal":
      if (ADDRESS_LITERAL_RE.test(expr.value))
        return { kind: "address" as SkittlesTypeKind };
      return { kind: "string" as SkittlesTypeKind };
    case "boolean-literal":
      return { kind: "bool" as SkittlesTypeKind };
    case "identifier":
      if (expr.name === "self")
        return { kind: "address" as SkittlesTypeKind };
      return varTypes.get(expr.name);
    case "property-access":
      // addr.balance → uint256 (ETH balance of an address)
      if (expr.property === "balance") {
        const objType = inferType(expr.object, varTypes);
        if (objType?.kind === ("address" as SkittlesTypeKind))
          return { kind: "uint256" as SkittlesTypeKind };
      }
      if (expr.object.kind === "identifier") {
        if (expr.object.name === "this") {
          // Always resolve this.<prop> against state-variable types so that
          // local/param shadowing cannot affect state-variable type inference.
          return ctx.stateVarTypes.get(expr.property) ?? varTypes.get(expr.property);
        }
        if (expr.object.name === "msg") {
          if (expr.property === "sender")
            return { kind: "address" as SkittlesTypeKind };
          if (expr.property === "value")
            return { kind: "uint256" as SkittlesTypeKind };
          if (expr.property === "data")
            return { kind: "bytes" as SkittlesTypeKind };
          if (expr.property === "sig")
            return { kind: "bytes32" as SkittlesTypeKind };
        }
        if (expr.object.name === "block") {
          if (expr.property === "coinbase")
            return { kind: "address" as SkittlesTypeKind };
          return { kind: "uint256" as SkittlesTypeKind };
        }
        if (expr.object.name === "tx") {
          if (expr.property === "origin")
            return { kind: "address" as SkittlesTypeKind };
          return { kind: "uint256" as SkittlesTypeKind };
        }
      }
      return undefined;
    case "element-access": {
      const objType = inferType(expr.object, varTypes);
      if (objType?.kind === ("mapping" as SkittlesTypeKind))
        return objType.valueType;
      if (objType?.kind === ("array" as SkittlesTypeKind))
        return objType.valueType;
      return undefined;
    }
    case "binary":
      if (
        ["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(
          expr.operator
        )
      ) {
        return { kind: "bool" as SkittlesTypeKind };
      }
      return inferType(expr.left, varTypes);
    case "unary":
      if (expr.operator === "!")
        return { kind: "bool" as SkittlesTypeKind };
      return inferType(expr.operand, varTypes);
    case "conditional":
      return inferType(expr.whenTrue, varTypes) ?? inferType(expr.whenFalse, varTypes);
    case "call":
      if (expr.callee.kind === "identifier") {
        // address(...) cast returns address type
        if (expr.callee.name === "address") {
          return { kind: "address" as SkittlesTypeKind };
        }
        if (expr.callee.name === "keccak256" || expr.callee.name === "sha256" || expr.callee.name === "hash") {
          return { kind: "bytes32" as SkittlesTypeKind };
        }
        if (STRING_RETURNING_HELPERS.has(expr.callee.name)) {
          return { kind: "string" as SkittlesTypeKind };
        }
        if (expr.callee.name === "_startsWith" || expr.callee.name === "_endsWith") {
          return { kind: "bool" as SkittlesTypeKind };
        }
        if (expr.callee.name === "_split") {
          return { kind: "array" as SkittlesTypeKind, valueType: { kind: "string" as SkittlesTypeKind } };
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

export function typesEqual(a: SkittlesType, b: SkittlesType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.structName !== b.structName) return false;
  if ((a.keyType === undefined) !== (b.keyType === undefined)) return false;
  if (a.keyType && b.keyType && !typesEqual(a.keyType, b.keyType)) return false;
  if ((a.valueType === undefined) !== (b.valueType === undefined)) return false;
  if (a.valueType && b.valueType && !typesEqual(a.valueType, b.valueType)) return false;
  if ((a.tupleTypes === undefined) !== (b.tupleTypes === undefined)) return false;
  if (a.tupleTypes && b.tupleTypes) {
    if (a.tupleTypes.length !== b.tupleTypes.length) return false;
    for (let i = 0; i < a.tupleTypes.length; i++) {
      if (!typesEqual(a.tupleTypes[i], b.tupleTypes[i])) return false;
    }
  }
  return true;
}
