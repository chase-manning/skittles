import { YulSection } from "../data/yul-template";
import { getEventSelector } from "../helpers/selector-helper";
import { addToSection } from "../helpers/yul-helper";
import { SkittlesEventType } from "../types/skittles-contract";

const addEvents = (yul: string[], events: SkittlesEventType[]): string[] => {
  const yuls = events.map((event) => {
    const { label, parameters } = event;
    const hashVarName = `${event.label}Hash`;
    return [
      `function emit${label}Event(${parameters.map((p) => `${p.name}Var`).join(", ")}) {`,
      `let ${hashVarName} := ${getEventSelector(event)}`,
      ...parameters.map((p, index: number) => `mstore(${index * 32}, ${p.name}Var)`),
      `log1(0, ${32 * parameters.length}, ${hashVarName})`,
      `}`,
    ];
  });
  return addToSection(
    addToSection(yul, YulSection.ConstructorEvents, yuls.flat()),
    YulSection.Events,
    yuls.flat()
  );
};

export default addEvents;
