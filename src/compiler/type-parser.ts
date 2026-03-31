import ts from "typescript";

import {
  ADDRESS_LITERAL_RE,
  type Expression,
  type SkittlesParameter,
  type SkittlesType,
  SkittlesTypeKind,
} from "../types/index.ts";
import { ctx } from "./parser-context.ts";
import { STRING_RETURNING_HELPERS } from "./parser-utils.ts";

export function parseTypeLiteralFields(
  node: ts.TypeLiteralNode
): SkittlesParameter[] {
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
        : { kind: SkittlesTypeKind.Uint256 };
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
    return { kind: SkittlesTypeKind.Bool };
  }

  if (ts.isTypeReferenceNode(node)) {
    const name = ts.isIdentifier(node.typeName)
      ? node.typeName.text
      : node.typeName.getText();

    if (
      (name === "Record" || name === "Map") &&
      node.typeArguments &&
      node.typeArguments.length === 2
    ) {
      return {
        kind: SkittlesTypeKind.Mapping,
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
        kind: SkittlesTypeKind.Array,
        valueType: parseType(node.typeArguments[0]),
      };
    }

    if (name === "address") return { kind: SkittlesTypeKind.Address };
    if (name === "bytes") return { kind: SkittlesTypeKind.Bytes };
    if (name === "bytes32") return { kind: SkittlesTypeKind.Bytes32 };

    if (ctx.knownStructs.has(name)) {
      return {
        kind: SkittlesTypeKind.Struct,
        structName: name,
        structFields: ctx.knownStructs.get(name),
      };
    }

    if (ctx.knownContractInterfaces.has(name)) {
      return {
        kind: SkittlesTypeKind.ContractInterface,
        structName: name,
      };
    }

    if (ctx.knownEnums.has(name)) {
      return {
        kind: SkittlesTypeKind.Enum,
        structName: name,
      };
    }

    throw new Error(
      `Unsupported type reference: "${name}". Skittles supports number, string, boolean, address, bytes, bytes32, Record<K,V>, T[], type structs, interfaces, and enums.`
    );
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: SkittlesTypeKind.Array,
      valueType: parseType(node.elementType),
    };
  }

  if (
    ts.isTypeOperatorNode(node) &&
    node.operator === ts.SyntaxKind.ReadonlyKeyword
  ) {
    return parseType(node.type);
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: SkittlesTypeKind.Tuple,
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
      return { kind: SkittlesTypeKind.Uint256 };
    case ts.SyntaxKind.StringKeyword:
      return { kind: SkittlesTypeKind.String };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: SkittlesTypeKind.Bool };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: SkittlesTypeKind.Void };
    default:
      throw new Error(
        `Unsupported type node kind: ${ts.SyntaxKind[node.kind]}. Skittles supports number, string, boolean, address, bytes, bytes32, Record<K,V>, and T[].`
      );
  }
}

export function inferType(
  expr: Expression,
  varTypes: Map<string, SkittlesType>
): SkittlesType | undefined {
  switch (expr.kind) {
    case "number-literal":
      return { kind: SkittlesTypeKind.Uint256 };
    case "string-literal":
      if (ADDRESS_LITERAL_RE.test(expr.value))
        return { kind: SkittlesTypeKind.Address };
      return { kind: SkittlesTypeKind.String };
    case "boolean-literal":
      return { kind: SkittlesTypeKind.Bool };
    case "identifier":
      if (expr.name === "self") return { kind: SkittlesTypeKind.Address };
      return varTypes.get(expr.name);
    case "property-access":
      // addr.balance → uint256 (ETH balance of an address)
      if (expr.property === "balance") {
        const objType = inferType(expr.object, varTypes);
        if (objType?.kind === SkittlesTypeKind.Address)
          return { kind: SkittlesTypeKind.Uint256 };
      }
      if (expr.object.kind === "identifier") {
        if (expr.object.name === "this") {
          // Always resolve this.<prop> against state-variable types so that
          // local/param shadowing cannot affect state-variable type inference.
          return (
            ctx.stateVarTypes.get(expr.property) ?? varTypes.get(expr.property)
          );
        }
        if (expr.object.name === "msg") {
          if (expr.property === "sender")
            return { kind: SkittlesTypeKind.Address };
          if (expr.property === "value")
            return { kind: SkittlesTypeKind.Uint256 };
          if (expr.property === "data") return { kind: SkittlesTypeKind.Bytes };
          if (expr.property === "sig")
            return { kind: SkittlesTypeKind.Bytes32 };
        }
        if (expr.object.name === "block") {
          if (expr.property === "coinbase")
            return { kind: SkittlesTypeKind.Address };
          return { kind: SkittlesTypeKind.Uint256 };
        }
        if (expr.object.name === "tx") {
          if (expr.property === "origin")
            return { kind: SkittlesTypeKind.Address };
          return { kind: SkittlesTypeKind.Uint256 };
        }
      }
      return undefined;
    case "element-access": {
      const objType = inferType(expr.object, varTypes);
      if (objType?.kind === SkittlesTypeKind.Mapping) return objType.valueType;
      if (objType?.kind === SkittlesTypeKind.Array) return objType.valueType;
      return undefined;
    }
    case "binary":
      if (
        ["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(expr.operator)
      ) {
        return { kind: SkittlesTypeKind.Bool };
      }
      return inferType(expr.left, varTypes);
    case "unary":
      if (expr.operator === "!") return { kind: SkittlesTypeKind.Bool };
      return inferType(expr.operand, varTypes);
    case "conditional": {
      const trueType = inferType(expr.whenTrue, varTypes);
      const falseType = inferType(expr.whenFalse, varTypes);
      if (!trueType || !falseType) return undefined;
      return typesEqual(trueType, falseType) ? trueType : undefined;
    }
    case "call":
      if (expr.callee.kind === "identifier") {
        // address(...) cast returns address type
        if (expr.callee.name === "address") {
          return { kind: SkittlesTypeKind.Address };
        }
        // Number(...) cast returns uint256 type
        if (expr.callee.name === "Number") {
          return { kind: SkittlesTypeKind.Uint256 };
        }
        if (
          expr.callee.name === "keccak256" ||
          expr.callee.name === "sha256" ||
          expr.callee.name === "hash"
        ) {
          return { kind: SkittlesTypeKind.Bytes32 };
        }
        if (STRING_RETURNING_HELPERS.has(expr.callee.name)) {
          return { kind: SkittlesTypeKind.String };
        }
        if (
          expr.callee.name === "_startsWith" ||
          expr.callee.name === "_endsWith"
        ) {
          return { kind: SkittlesTypeKind.Bool };
        }
        if (expr.callee.name === "_split") {
          return {
            kind: SkittlesTypeKind.Array,
            valueType: { kind: SkittlesTypeKind.String },
          };
        }
      }
      // Interface method call: obj.method(...) where obj is a contract interface
      if (expr.callee.kind === "property-access") {
        const objType = inferType(expr.callee.object, varTypes);
        if (
          objType?.kind === SkittlesTypeKind.ContractInterface &&
          objType.structName
        ) {
          const iface = ctx.knownContractInterfaceMap.get(objType.structName);
          if (iface) {
            const method = iface.functions.find(
              (f) =>
                f.name ===
                (expr.callee as Extract<Expression, { kind: "property-access" }>)
                  .property
            );
            if (method?.returnType) {
              return method.returnType;
            }
          }
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
  if (a.valueType && b.valueType && !typesEqual(a.valueType, b.valueType))
    return false;
  if ((a.tupleTypes === undefined) !== (b.tupleTypes === undefined))
    return false;
  if (a.tupleTypes && b.tupleTypes) {
    if (a.tupleTypes.length !== b.tupleTypes.length) return false;
    for (let i = 0; i < a.tupleTypes.length; i++) {
      if (!typesEqual(a.tupleTypes[i], b.tupleTypes[i])) return false;
    }
  }
  return true;
}
