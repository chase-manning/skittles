import { cctx } from "../codegen-context.ts";
import {
  CHAR_0,
  CHAR_A,
  CHAR_a,
  CHAR_SPACE,
  CHAR_Z,
  CHAR_z,
  ERR_START_OUT_OF_BOUNDS,
} from "../constants.ts";

// Registry of helper function names to their Solidity code lines.
// Each entry maps a helper name to a thunk returning its code lines
// (thunks are used so that constant references are evaluated at call time).
export const HELPER_REGISTRY: Array<{ name: string; lines: () => string[] }> = [
  {
    name: "_min",
    lines: () => [
      "    function _min(uint256 a, uint256 b) internal pure returns (uint256) {",
      "        return a < b ? a : b;",
      "    }",
    ],
  },
  {
    name: "_max",
    lines: () => [
      "    function _max(uint256 a, uint256 b) internal pure returns (uint256) {",
      "        return a > b ? a : b;",
      "    }",
    ],
  },
  {
    name: "_sqrt",
    lines: () => [
      "    function _sqrt(uint256 x) internal pure returns (uint256) {",
      "        if (x == 0) return 0;",
      "        uint256 z = (x + 1) / 2;",
      "        uint256 y = x;",
      "        while (z < y) {",
      "            y = z;",
      "            z = (x / z + z) / 2;",
      "        }",
      "        return y;",
      "    }",
    ],
  },
  {
    name: "_charAt",
    lines: () => [
      "    function _charAt(string memory str, uint256 index) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        require(index < strBytes.length);",
      "        bytes memory result = new bytes(1);",
      "        result[0] = strBytes[index];",
      "        return string(result);",
      "    }",
    ],
  },
  {
    name: "_substring",
    lines: () => [
      "    function _substring(string memory str, uint256 start, uint256 end) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        require(start <= end && end <= strBytes.length);",
      "        bytes memory result = new bytes(end - start);",
      "        for (uint256 i = start; i < end; i++) {",
      "            result[i - start] = strBytes[i];",
      "        }",
      "        return string(result);",
      "    }",
    ],
  },
  {
    name: "_toLowerCase",
    lines: () => [
      "    function _toLowerCase(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory result = new bytes(strBytes.length);",
      "        for (uint256 i = 0; i < strBytes.length; i++) {",
      "            uint8 c = uint8(strBytes[i]);",
      `            if (c >= ${CHAR_A} && c <= ${CHAR_Z}) {`,
      `                result[i] = bytes1(c + ${CHAR_SPACE});`,
      "            } else {",
      "                result[i] = strBytes[i];",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ],
  },
  {
    name: "_toUpperCase",
    lines: () => [
      "    function _toUpperCase(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory result = new bytes(strBytes.length);",
      "        for (uint256 i = 0; i < strBytes.length; i++) {",
      "            uint8 c = uint8(strBytes[i]);",
      `            if (c >= ${CHAR_a} && c <= ${CHAR_z}) {`,
      `                result[i] = bytes1(c - ${CHAR_SPACE});`,
      "            } else {",
      "                result[i] = strBytes[i];",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ],
  },
  {
    name: "_startsWith",
    lines: () => [
      "    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory prefixBytes = bytes(prefix);",
      "        if (prefixBytes.length > strBytes.length) return false;",
      "        for (uint256 i = 0; i < prefixBytes.length; i++) {",
      "            if (strBytes[i] != prefixBytes[i]) return false;",
      "        }",
      "        return true;",
      "    }",
    ],
  },
  {
    name: "_endsWith",
    lines: () => [
      "    function _endsWith(string memory str, string memory suffix) internal pure returns (bool) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory suffixBytes = bytes(suffix);",
      "        if (suffixBytes.length > strBytes.length) return false;",
      "        uint256 offset = strBytes.length - suffixBytes.length;",
      "        for (uint256 i = 0; i < suffixBytes.length; i++) {",
      "            if (strBytes[offset + i] != suffixBytes[i]) return false;",
      "        }",
      "        return true;",
      "    }",
    ],
  },
  {
    name: "_trim",
    lines: () => [
      "    function _trim(string memory str) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        uint256 start = 0;",
      "        uint256 end = strBytes.length;",
      `        while (start < end && uint8(strBytes[start]) == ${CHAR_SPACE}) { start++; }`,
      `        while (end > start && uint8(strBytes[end - 1]) == ${CHAR_SPACE}) { end--; }`,
      "        bytes memory result = new bytes(end - start);",
      "        for (uint256 i = start; i < end; i++) {",
      "            result[i - start] = strBytes[i];",
      "        }",
      "        return string(result);",
      "    }",
    ],
  },
  {
    name: "_split",
    lines: () => [
      "    function _split(string memory str, string memory delimiter) internal pure returns (string[] memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory delimBytes = bytes(delimiter);",
      "        require(delimBytes.length > 0);",
      "        uint256 __sk_count = 1;",
      "        for (uint256 i = 0; i + delimBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < delimBytes.length; j++) {",
      "                if (strBytes[i + j] != delimBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) { __sk_count++; i += delimBytes.length - 1; }",
      "        }",
      "        string[] memory parts = new string[](__sk_count);",
      "        uint256 partIndex = 0;",
      "        uint256 start = 0;",
      "        for (uint256 i = 0; i + delimBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < delimBytes.length; j++) {",
      "                if (strBytes[i + j] != delimBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) {",
      "                bytes memory part = new bytes(i - start);",
      "                for (uint256 k = start; k < i; k++) { part[k - start] = strBytes[k]; }",
      "                parts[partIndex++] = string(part);",
      "                start = i + delimBytes.length;",
      "                i += delimBytes.length - 1;",
      "            }",
      "        }",
      "        bytes memory lastPart = new bytes(strBytes.length - start);",
      "        for (uint256 k = start; k < strBytes.length; k++) { lastPart[k - start] = strBytes[k]; }",
      "        parts[partIndex] = string(lastPart);",
      "        return parts;",
      "    }",
    ],
  },
  {
    name: "__sk_toString",
    lines: () => [
      "    function __sk_toString(uint256 value) internal pure returns (string memory) {",
      '        if (value == 0) return "0";',
      "        uint256 temp = value;",
      "        uint256 digits;",
      "        while (temp != 0) { digits++; temp /= 10; }",
      "        bytes memory buffer = new bytes(digits);",
      "        while (value != 0) {",
      "            digits--;",
      `            buffer[digits] = bytes1(uint8(${CHAR_0} + (value % 10)));`,
      "            value /= 10;",
      "        }",
      "        return string(buffer);",
      "    }",
    ],
  },
  {
    name: "_replace",
    lines: () => [
      "    function _replace(string memory str, string memory search, string memory replacement) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory searchBytes = bytes(search);",
      "        bytes memory replBytes = bytes(replacement);",
      "        require(searchBytes.length > 0);",
      "        for (uint256 i = 0; i + searchBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) {",
      "                bytes memory result = new bytes(strBytes.length - searchBytes.length + replBytes.length);",
      "                for (uint256 k = 0; k < i; k++) { result[k] = strBytes[k]; }",
      "                for (uint256 k = 0; k < replBytes.length; k++) { result[i + k] = replBytes[k]; }",
      "                for (uint256 k = i + searchBytes.length; k < strBytes.length; k++) { result[k - searchBytes.length + replBytes.length] = strBytes[k]; }",
      "                return string(result);",
      "            }",
      "        }",
      "        return str;",
      "    }",
    ],
  },
  {
    name: "_replaceAll",
    lines: () => [
      "    function _replaceAll(string memory str, string memory search, string memory replacement) internal pure returns (string memory) {",
      "        bytes memory strBytes = bytes(str);",
      "        bytes memory searchBytes = bytes(search);",
      "        bytes memory replBytes = bytes(replacement);",
      "        require(searchBytes.length > 0);",
      "        uint256 __sk_count = 0;",
      "        for (uint256 i = 0; i + searchBytes.length <= strBytes.length; i++) {",
      "            bool found = true;",
      "            for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "            }",
      "            if (found) { __sk_count++; i += searchBytes.length - 1; }",
      "        }",
      "        if (__sk_count == 0) return str;",
      "        bytes memory result = new bytes(strBytes.length - (__sk_count * searchBytes.length) + (__sk_count * replBytes.length));",
      "        uint256 idx = 0;",
      "        for (uint256 i = 0; i < strBytes.length; ) {",
      "            bool found = false;",
      "            if (i + searchBytes.length <= strBytes.length) {",
      "                found = true;",
      "                for (uint256 j = 0; j < searchBytes.length; j++) {",
      "                    if (strBytes[i + j] != searchBytes[j]) { found = false; break; }",
      "                }",
      "            }",
      "            if (found) {",
      "                for (uint256 k = 0; k < replBytes.length; k++) { result[idx++] = replBytes[k]; }",
      "                i += searchBytes.length;",
      "            } else {",
      "                result[idx++] = strBytes[i];",
      "                i++;",
      "            }",
      "        }",
      "        return string(result);",
      "    }",
    ],
  },
];

export const SOLIDITY_VALUE_TYPES = new Set([
  "uint256",
  "int256",
  "address",
  "bool",
  "bytes32",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uint128",
  "int8",
  "int16",
  "int32",
  "int64",
  "int128",
  "bytes1",
  "bytes2",
  "bytes3",
  "bytes4",
]);

export const hasAncestorOrigin = (
  origins: Set<string> | undefined,
  ancestors: Set<string>
): boolean =>
  origins !== undefined && Array.from(origins).some((o) => ancestors.has(o));

function suffixToSolType(suffix: string): string {
  if (suffix.startsWith("arr_")) return `${suffixToSolType(suffix.slice(4))}[]`;
  return suffix;
}

export function emitHelperFunctions(
  parts: string[],
  addOrigin: (map: Map<string, Set<string>>, key: string) => void,
  functionOrigins: Map<string, Set<string>>,
  ancestors: Set<string>
): void {
  const needsHelper = (name: string, flag: boolean): boolean =>
    flag && !hasAncestorOrigin(functionOrigins.get(name), ancestors);

  const emitHelper = (name: string, lines: string[]): void => {
    addOrigin(functionOrigins, name);
    parts.push("");
    for (const line of lines) parts.push(line);
  };

  // Emit registered helpers using the table-driven registry
  for (const entry of HELPER_REGISTRY) {
    if (needsHelper(entry.name, cctx.helpers.has(entry.name))) {
      emitHelper(entry.name, entry.lines());
    }
  }

  // Emit array helper functions based on what methods are used,
  // skipping any already emitted by an ancestor contract in this file
  for (const helperKey of cctx.currentNeededArrayHelpers) {
    const [method, ...typeParts] = helperKey.split("_");
    const suffix = typeParts.join("_");
    const solType = suffixToSolType(suffix);
    const isRefType =
      !SOLIDITY_VALUE_TYPES.has(solType) &&
      !cctx.allKnownEnumNames.has(solType) &&
      !cctx.allKnownInterfaceNames.has(solType);
    const useHashEq = solType === "string" || solType === "bytes";
    const memAnnotation = isRefType ? "memory " : "";
    const eqCheck = useHashEq
      ? `keccak256(abi.encodePacked(arr[i])) == keccak256(abi.encodePacked(value))`
      : `arr[i] == value`;

    if (method === "includes" && needsHelper(`_arrIncludes_${suffix}`, true)) {
      emitHelper(`_arrIncludes_${suffix}`, [
        `    function _arrIncludes_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (bool) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) return true;`,
        `        }`,
        `        return false;`,
        `    }`,
      ]);
    }

    if (method === "indexOf" && needsHelper(`_arrIndexOf_${suffix}`, true)) {
      emitHelper(`_arrIndexOf_${suffix}`, [
        `    function _arrIndexOf_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (uint256) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) return i;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (
      method === "lastIndexOf" &&
      needsHelper(`_arrLastIndexOf_${suffix}`, true)
    ) {
      emitHelper(`_arrLastIndexOf_${suffix}`, [
        `    function _arrLastIndexOf_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal view returns (uint256) {`,
        `        for (uint256 i = arr.length; i > 0; i--) {`,
        `            if (${eqCheck.replace(/arr\[i\]/g, "arr[i - 1]")}) return i - 1;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (method === "remove" && needsHelper(`_arrRemove_${suffix}`, true)) {
      emitHelper(`_arrRemove_${suffix}`, [
        `    function _arrRemove_${suffix}(${solType}[] storage arr, ${solType} ${memAnnotation}value) internal returns (bool) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${eqCheck}) {`,
        `                arr[i] = arr[arr.length - 1];`,
        `                arr.pop();`,
        `                return true;`,
        `            }`,
        `        }`,
        `        return false;`,
        `    }`,
      ]);
    }

    if (method === "reverse" && needsHelper(`_arrReverse_${suffix}`, true)) {
      emitHelper(`_arrReverse_${suffix}`, [
        `    function _arrReverse_${suffix}(${solType}[] storage arr) internal {`,
        `        uint256 len = arr.length;`,
        `        for (uint256 i = 0; i < len / 2; i++) {`,
        `            ${solType} ${memAnnotation}temp = arr[i];`,
        `            arr[i] = arr[len - 1 - i];`,
        `            arr[len - 1 - i] = temp;`,
        `        }`,
        `    }`,
      ]);
    }

    if (method === "splice" && needsHelper(`_arrSplice_${suffix}`, true)) {
      emitHelper(`_arrSplice_${suffix}`, [
        `    function _arrSplice_${suffix}(${solType}[] storage arr, uint256 start, uint256 deleteCount) internal {`,
        `        require(start < arr.length, "${ERR_START_OUT_OF_BOUNDS}");`,
        `        uint256 end = start + deleteCount;`,
        `        if (end > arr.length) end = arr.length;`,
        `        uint256 removed = end - start;`,
        `        for (uint256 i = start; i < arr.length - removed; i++) {`,
        `            arr[i] = arr[i + removed];`,
        `        }`,
        `        for (uint256 i = 0; i < removed; i++) {`,
        `            arr.pop();`,
        `        }`,
        `    }`,
      ]);
    }

    if (method === "slice" && needsHelper(`_arrSlice_${suffix}`, true)) {
      emitHelper(`_arrSlice_${suffix}`, [
        `    function _arrSlice_${suffix}(${solType}[] storage arr, uint256 start, uint256 end) internal view returns (${solType}[] memory) {`,
        `        if (end > arr.length) end = arr.length;`,
        `        require(start <= end, "invalid slice range");`,
        `        ${solType}[] memory result = new ${solType}[](end - start);`,
        `        for (uint256 i = start; i < end; i++) {`,
        `            result[i - start] = arr[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    if (method === "concat" && needsHelper(`_arrConcat_${suffix}`, true)) {
      emitHelper(`_arrConcat_${suffix}`, [
        `    function _arrConcat_${suffix}(${solType}[] storage arr, ${solType}[] memory other) internal view returns (${solType}[] memory) {`,
        `        ${solType}[] memory result = new ${solType}[](arr.length + other.length);`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            result[i] = arr[i];`,
        `        }`,
        `        for (uint256 i = 0; i < other.length; i++) {`,
        `            result[arr.length + i] = other[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    if (method === "spread" && needsHelper(`_arrSpread_${suffix}`, true)) {
      emitHelper(`_arrSpread_${suffix}`, [
        `    function _arrSpread_${suffix}(${solType}[] memory a, ${solType}[] memory b) internal pure returns (${solType}[] memory) {`,
        `        ${solType}[] memory result = new ${solType}[](a.length + b.length);`,
        `        for (uint256 i = 0; i < a.length; i++) {`,
        `            result[i] = a[i];`,
        `        }`,
        `        for (uint256 i = 0; i < b.length; i++) {`,
        `            result[a.length + i] = b[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    // Memory-based variants for chained array operations (intermediate results are memory arrays)

    const memEqCheck = useHashEq
      ? `keccak256(abi.encodePacked(arr[i])) == keccak256(abi.encodePacked(value))`
      : `arr[i] == value`;

    if (method === "memIncludes" && needsHelper(`_arrMemIncludes_${suffix}`, true)) {
      emitHelper(`_arrMemIncludes_${suffix}`, [
        `    function _arrMemIncludes_${suffix}(${solType}[] memory arr, ${solType} ${memAnnotation}value) internal pure returns (bool) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${memEqCheck}) return true;`,
        `        }`,
        `        return false;`,
        `    }`,
      ]);
    }

    if (method === "memIndexOf" && needsHelper(`_arrMemIndexOf_${suffix}`, true)) {
      emitHelper(`_arrMemIndexOf_${suffix}`, [
        `    function _arrMemIndexOf_${suffix}(${solType}[] memory arr, ${solType} ${memAnnotation}value) internal pure returns (uint256) {`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            if (${memEqCheck}) return i;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (
      method === "memLastIndexOf" &&
      needsHelper(`_arrMemLastIndexOf_${suffix}`, true)
    ) {
      emitHelper(`_arrMemLastIndexOf_${suffix}`, [
        `    function _arrMemLastIndexOf_${suffix}(${solType}[] memory arr, ${solType} ${memAnnotation}value) internal pure returns (uint256) {`,
        `        for (uint256 i = arr.length; i > 0; i--) {`,
        `            if (${memEqCheck.replace(/arr\[i\]/g, "arr[i - 1]")}) return i - 1;`,
        `        }`,
        `        return type(uint256).max;`,
        `    }`,
      ]);
    }

    if (method === "memReverse" && needsHelper(`_arrMemReverse_${suffix}`, true)) {
      emitHelper(`_arrMemReverse_${suffix}`, [
        `    function _arrMemReverse_${suffix}(${solType}[] memory arr) internal pure {`,
        `        uint256 len = arr.length;`,
        `        for (uint256 i = 0; i < len / 2; i++) {`,
        `            ${solType} ${memAnnotation}temp = arr[i];`,
        `            arr[i] = arr[len - 1 - i];`,
        `            arr[len - 1 - i] = temp;`,
        `        }`,
        `    }`,
      ]);
    }

    if (method === "memSlice" && needsHelper(`_arrMemSlice_${suffix}`, true)) {
      emitHelper(`_arrMemSlice_${suffix}`, [
        `    function _arrMemSlice_${suffix}(${solType}[] memory arr, uint256 start, uint256 end) internal pure returns (${solType}[] memory) {`,
        `        if (end > arr.length) end = arr.length;`,
        `        require(start <= end, "invalid slice range");`,
        `        ${solType}[] memory result = new ${solType}[](end - start);`,
        `        for (uint256 i = start; i < end; i++) {`,
        `            result[i - start] = arr[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }

    if (method === "memConcat" && needsHelper(`_arrMemConcat_${suffix}`, true)) {
      emitHelper(`_arrMemConcat_${suffix}`, [
        `    function _arrMemConcat_${suffix}(${solType}[] memory arr, ${solType}[] memory other) internal pure returns (${solType}[] memory) {`,
        `        ${solType}[] memory result = new ${solType}[](arr.length + other.length);`,
        `        for (uint256 i = 0; i < arr.length; i++) {`,
        `            result[i] = arr[i];`,
        `        }`,
        `        for (uint256 i = 0; i < other.length; i++) {`,
        `            result[arr.length + i] = other[i];`,
        `        }`,
        `        return result;`,
        `    }`,
      ]);
    }
  }
}
