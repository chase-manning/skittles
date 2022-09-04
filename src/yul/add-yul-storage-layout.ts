import { YulSection } from "../data/yul-template";
import { getVariables } from "../helpers/string-helper";
import { addToSection } from "../helpers/yul-helper";
import SkittlesContract, {
  SkittlesTypeKind,
  SkittlesVariable,
} from "../types/skittles-class";

const _addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  skittlesClass: SkittlesContract,
  section: YulSection,
  slot: number
): StorageLayoutResponse => {
  if (property.immutable) return { yul, slot: slot + 1 };
  const { name, type } = property;
  if (type.kind === SkittlesTypeKind.Mapping) {
    const matchingMappings = skittlesClass.variables.filter((v) => {
      return (
        v.type.kind === SkittlesTypeKind.Mapping &&
        v.type.inputs.length === type.inputs.length
      );
    });
    const index = matchingMappings.findIndex((v) => v.name === property.name);

    const variables = getVariables(type.inputs.length);
    const extraVars = variables.split(", ").slice(1);
    const extraVarsYul = [
      `mstore(0, p)`,
      ...extraVars.map(
        (v: string, index: number) => `mstore(0x${index * 20}, ${v})`
      ),
      `p := keccak256(0, 0x${type.inputs.length * 20})`,
    ];
    return {
      yul: addToSection(yul, section, [
        `function ${name}Pos(${variables}) -> p {`,
        `p := add(0x${index + 1}000, a)`,
        ...(extraVars.length > 0 ? extraVarsYul : []),
        `}`,
      ]),
      slot,
    };
  }
  if (type.kind === SkittlesTypeKind.Array) {
    yul = addToSection(yul, section, [
      `function ${name}LengthPos() -> p { p := ${slot} }`,
    ]);
    yul = addToSection(yul, section, [
      `function ${name}ArrayPos() -> p { p := ${slot + 1} }`,
    ]);
    return {
      yul,
      slot: slot + 2 ** 64,
    };
  }
  return {
    yul: addToSection(yul, section, [
      `function ${name}Pos() -> p { p := ${slot} }`,
    ]),
    slot: slot + 1,
  };
};

interface StorageLayoutResponse {
  yul: string[];
  slot: number;
}

const addStorageLayout = (
  yul: string[],
  property: SkittlesVariable,
  skittlesClass: SkittlesContract,
  slot: number,
  constructor?: boolean
): StorageLayoutResponse => {
  return _addStorageLayout(
    yul,
    property,
    skittlesClass,
    constructor
      ? YulSection.ConstructorStorageLayout
      : YulSection.StorageLayout,
    slot
  );
};

export default addStorageLayout;
