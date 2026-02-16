"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashString = exports.getVariables = exports.subStringCount = void 0;
// Count instances of substring in string
const subStringCount = (str, subString) => {
    return str.split(subString).length - 1;
};
exports.subStringCount = subStringCount;
// Get a list of n variables separated by a comma (e.g. a, b, c)
const getVariables = (n) => {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return alphabet.substring(0, n).split("").join(", ");
};
exports.getVariables = getVariables;
const hashString = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
exports.hashString = hashString;
