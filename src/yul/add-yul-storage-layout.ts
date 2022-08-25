import { YulSection } from "../data/yul-template";
import { getVariables, subStringCount } from "../helpers/string-helper";
import { addToSection } from "../helpers/yul-helper";
import SkittlesClass, {
  SkittlesTypeKind,
  SkittlesVariable,
} from "../types/skittles-class";

const _addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  index: number,
  section: YulSection
) => {
  if (property.immutable) return yul;
  const { name, type } = property;
  if (type.kind === SkittlesTypeKind.Mapping) {
    const variables = getVariables(type.inputs.length);
    const extraVars = variables.split(", ").slice(1);
    const extraVarsYul = [
      `mstore(0, p)`,
      ...extraVars.map(
        (v: string, index: number) => `mstore(0x${index * 20}, ${v})`
      ),
      `p := keccak256(0, 0x${type.inputs.length * 20})`,
    ];
    return addToSection(yul, section, [
      `function ${name}Pos(${variables}) -> p {`,
      `p := add(0x${index + 1}000, a)`,
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
  skittlesClass: SkittlesClass,
  index: number,
  constructor?: boolean
) => {
  const { type } = property;
  if (type.kind === SkittlesTypeKind.Mapping) {
    const matchingMappings = skittlesClass.variables.filter((v) => {
      return (
        v.type.kind === SkittlesTypeKind.Mapping &&
        v.type.inputs.length === type.inputs.length
      );
    });
    index = matchingMappings.findIndex((v) => v.name === property.name);
  }
  return _addStorageLayout(
    yul,
    property,
    index,
    constructor ? YulSection.ConstructorStorageLayout : YulSection.StorageLayout
  );
};

export default addStorageLayout;
