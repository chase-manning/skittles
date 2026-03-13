import {
  ADDRESS_LITERAL_RE,
  type Expression,
  type SkittlesType,
  SkittlesTypeKind,
} from "../../types/index.ts";
import { cctx } from "../codegen-context.ts";

// ============================================================
// Type generation
// ============================================================

export function generateType(type: SkittlesType): string {
  switch (type.kind) {
    case SkittlesTypeKind.Uint256:
      return "uint256";
    case SkittlesTypeKind.Int256:
      return "int256";
    case SkittlesTypeKind.Address:
      return "address";
    case SkittlesTypeKind.Bool:
      return "bool";
    case SkittlesTypeKind.String:
      return "string";
    case SkittlesTypeKind.Bytes32:
      return "bytes32";
    case SkittlesTypeKind.Bytes:
      return "bytes";
    case SkittlesTypeKind.Mapping:
      return `mapping(${generateType(type.keyType!)} => ${generateType(type.valueType!)})`;
    case SkittlesTypeKind.Array:
      return `${generateType(type.valueType!)}[]`;
    case SkittlesTypeKind.Struct:
      return type.structName ?? "UnknownStruct";
    case SkittlesTypeKind.ContractInterface:
      return type.structName ?? "UnknownInterface";
    case SkittlesTypeKind.Enum:
      return type.structName ?? "UnknownEnum";
    case SkittlesTypeKind.Tuple:
      return `(${(type.tupleTypes ?? []).map(generateType).join(", ")})`;
    case SkittlesTypeKind.Void:
      return "";
    default: {
      const _exhaustive: never = type.kind;
      throw new Error(`Unhandled type kind: ${_exhaustive}`);
    }
  }
}

export function generateParamType(type: SkittlesType): string {
  const base = generateType(type);
  if (needsMemoryLocation(type)) {
    return `${base} memory`;
  }
  return base;
}

export function generateCalldataParamType(type: SkittlesType): string {
  const base = generateType(type);
  if (needsMemoryLocation(type)) {
    return `${base} calldata`;
  }
  return base;
}

function needsMemoryLocation(type: SkittlesType): boolean {
  return [
    SkittlesTypeKind.String,
    SkittlesTypeKind.Bytes,
    SkittlesTypeKind.Array,
    SkittlesTypeKind.Struct,
  ].includes(type.kind);
}

// ============================================================
// Expression generation
// ============================================================

export function generateExpression(expr: Expression): string {
  switch (expr.kind) {
    case "number-literal":
      return expr.value;
    case "string-literal": {
      if (ADDRESS_LITERAL_RE.test(expr.value)) {
        return `address(${expr.value})`;
      }
      const escaped = expr.value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/[\x00-\x1f\x7f]/g, (ch) => {
          const hex = ch.charCodeAt(0).toString(16).padStart(2, "0");
          return `\\x${hex}`;
        });
      return `"${escaped}"`;
    }
    case "boolean-literal":
      return expr.value ? "true" : "false";
    case "identifier":
      if (expr.name === "self") return "address(this)";
      return expr.name;
    case "property-access":
      if (expr.object.kind === "identifier" && expr.object.name === "this") {
        return expr.property;
      }
      // Number.MAX_VALUE → type(uint256).max
      if (
        expr.object.kind === "identifier" &&
        expr.object.name === "Number" &&
        expr.property === "MAX_VALUE"
      ) {
        return "type(uint256).max";
      }
      // Number.MAX_SAFE_INTEGER → 9007199254740991 (2^53 - 1)
      if (
        expr.object.kind === "identifier" &&
        expr.object.name === "Number" &&
        expr.property === "MAX_SAFE_INTEGER"
      ) {
        return "9007199254740991";
      }
      return `${generateExpression(expr.object)}.${expr.property}`;
    case "element-access":
      return `${generateExpression(expr.object)}[${generateExpression(expr.index)}]`;
    case "binary":
      return `(${generateExpression(expr.left)} ${expr.operator} ${generateExpression(expr.right)})`;
    case "unary":
      if (expr.prefix) {
        return `${expr.operator}${generateExpression(expr.operand)}`;
      }
      return `${generateExpression(expr.operand)}${expr.operator}`;
    case "assignment":
      return `${generateExpression(expr.target)} ${expr.operator} ${generateExpression(expr.value)}`;
    case "call": {
      const callResult = tryGenerateBuiltinCall(expr);
      if (callResult) return callResult;
      // addr.transfer(amount) → payable(addr).transfer(amount)
      // Exclude this.transfer(...) (internal call) and this.stateVar.transfer(...)
      // (external contract interface call) to avoid misclassifying non-ETH transfers.
      if (
        expr.callee.kind === "property-access" &&
        expr.callee.property === "transfer" &&
        expr.args.length === 1 &&
        !isThisOrContractCall(expr.callee.object)
      ) {
        const addr = generateExpression(expr.callee.object);
        return `payable(${addr}).transfer(${generateExpression(expr.args[0])})`;
      }
      return `${generateExpression(expr.callee)}(${expr.args.map(generateExpression).join(", ")})`;
    }
    case "conditional":
      return `(${generateExpression(expr.condition)} ? ${generateExpression(expr.whenTrue)} : ${generateExpression(expr.whenFalse)})`;
    case "new":
      return `new ${expr.callee}(${expr.args.map(generateExpression).join(", ")})`;
    case "object-literal": {
      const values = expr.properties
        .map((p) => generateExpression(p.value))
        .join(", ");
      return values;
    }
    case "tuple-literal":
      return `(${expr.elements.map(generateExpression).join(", ")})`;
    default: {
      const _exhaustive: never = expr;
      throw new Error(`Unhandled expression kind: ${(_exhaustive as Expression).kind}`);
    }
  }
}

// ============================================================
// Built-in function recognition
// ============================================================

function getCallName(expr: Expression): string | null {
  if (expr.kind === "identifier") return expr.name;
  if (expr.kind === "property-access" && expr.object.kind === "identifier") {
    return `${expr.object.name}.${expr.property}`;
  }
  return null;
}

export function tryGenerateBuiltinCall(expr: {
  callee: Expression;
  args: Expression[];
  typeArgs?: SkittlesType[];
}): string | null {
  const name = getCallName(expr.callee);
  if (!name) return null;
  const args = expr.args.map(generateExpression).join(", ");

  switch (name) {
    case "hash":
    case "keccak256":
      return `keccak256(abi.encodePacked(${args}))`;
    case "sha256":
      return `sha256(abi.encodePacked(${args}))`;
    case "abi.encode":
      return `abi.encode(${args})`;
    case "abi.encodePacked":
      return `abi.encodePacked(${args})`;
    case "abi.decode": {
      if (expr.typeArgs && expr.typeArgs.length > 0) {
        const types = expr.typeArgs.map(generateType).join(", ");
        return `abi.decode(${args}, (${types}))`;
      }
      return `abi.decode(${args})`;
    }
    case "ecrecover": {
      const [hashArg, vArg, rArg, sArg] = expr.args.map(generateExpression);
      return `ecrecover(${hashArg}, uint8(${vArg}), ${rArg}, ${sArg})`;
    }
    case "addmod":
      return `addmod(${args})`;
    case "mulmod":
      return `mulmod(${args})`;
    case "assert":
      return `assert(${args})`;
    case "gasleft":
      return `gasleft()`;
    case "Contract":
      if (
        expr.typeArgs &&
        expr.typeArgs.length > 0 &&
        expr.typeArgs[0].kind === SkittlesTypeKind.ContractInterface &&
        expr.typeArgs[0].structName
      ) {
        return `${expr.typeArgs[0].structName}(${args})`;
      }
      throw new Error(
        "Contract<T>() requires a contract interface type argument, e.g. Contract<IToken>(address)"
      );
    case "string.concat":
      return `string.concat(${args})`;
    case "bytes.concat":
      return `bytes.concat(${args})`;
    case "__sk_toString": {
      cctx.helpers.add("__sk_toString");
      return `__sk_toString(${args})`;
    }
    case "Math.min": {
      cctx.helpers.add("_min");
      const a = generateExpression(expr.args[0]);
      const b = generateExpression(expr.args[1]);
      return `_min(${a}, ${b})`;
    }
    case "Math.max": {
      cctx.helpers.add("_max");
      const a = generateExpression(expr.args[0]);
      const b = generateExpression(expr.args[1]);
      return `_max(${a}, ${b})`;
    }
    case "Math.pow": {
      const base = generateExpression(expr.args[0]);
      const exp = generateExpression(expr.args[1]);
      return `(${base} ** ${exp})`;
    }
    case "Math.sqrt": {
      cctx.helpers.add("_sqrt");
      const x = generateExpression(expr.args[0]);
      return `_sqrt(${x})`;
    }
    case "_charAt": {
      cctx.helpers.add("_charAt");
      return `_charAt(${args})`;
    }
    case "_substring": {
      cctx.helpers.add("_substring");
      return `_substring(${args})`;
    }
    case "_toLowerCase": {
      cctx.helpers.add("_toLowerCase");
      return `_toLowerCase(${args})`;
    }
    case "_toUpperCase": {
      cctx.helpers.add("_toUpperCase");
      return `_toUpperCase(${args})`;
    }
    case "_startsWith": {
      cctx.helpers.add("_startsWith");
      return `_startsWith(${args})`;
    }
    case "_endsWith": {
      cctx.helpers.add("_endsWith");
      return `_endsWith(${args})`;
    }
    case "_trim": {
      cctx.helpers.add("_trim");
      return `_trim(${args})`;
    }
    case "_split": {
      cctx.helpers.add("_split");
      return `_split(${args})`;
    }
    case "_replace": {
      cctx.helpers.add("_replace");
      return `_replace(${args})`;
    }
    case "_replaceAll": {
      cctx.helpers.add("_replaceAll");
      return `_replaceAll(${args})`;
    }
    default:
      return null;
  }
}

/**
 * Check if a receiver expression is `this` (an internal contract method call).
 * Used to avoid wrapping `this.transfer(...)` calls in `payable(...)`.
 * Note: `this.stateVar.transfer(amount)` is NOT excluded here because
 * codegen strips `this.` and the arg count (1 for ETH transfer vs 2+ for
 * contract interface calls) serves as the discriminator.
 */
function isThisOrContractCall(receiver: Expression): boolean {
  return receiver.kind === "identifier" && receiver.name === "this";
}
