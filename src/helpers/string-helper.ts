// Count instances of substring in string
export const subStringCount = (str: string, subString: string) => {
  return str.split(subString).length - 1;
};

// Get a list of n variables separated by a comma (e.g. a, b, c)
export const getVariables = (n: number) => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return alphabet.substring(0, n).split("").join(", ");
};
