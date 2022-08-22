import { YulSection } from "../data/yul-template";
import { getVariables, subStringCount } from "../helpers/string-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesVariable } from "../types/skittles-class";

const _addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number,
  section: YulSection
) => {
  if (property.immutable) return yul;
  const { name, type } = property;
  if (type.includes("mapping")) {
    const mappings = subStringCount(type, "mapping");
    const variables = getVariables(mappings);
    const extraVars = variables.split(", ").slice(1);
    const extraVarsYul = [
      `mstore(0, p)`,
      ...extraVars.map(
        (v: string, index: number) => `mstore(0x${index * 20}, ${v})`
      ),
      `p := keccak256(0, 0x${mappings * 20})`,
    ];
    return addToSection(yul, section, [
      `function ${name}Pos(${variables}) -> p {`,
      `p := add(0x1000, a)`,
      ...(extraVars.length > 0 ? extraVarsYul : []),
      `}`,
    ]);
  }
  return addToSection(yul, section, [
    `function ${name}Pos() -> p { p := ${index} }`,
  ]);
};

const addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number,
  constructor?: boolean
) => {
  return _addStorageLayout(
    yul,
    property,
    index,
    constructor ? YulSection.ConstructorStorageLayout : YulSection.StorageLayout
  );
};

export default addStorageLayout;
