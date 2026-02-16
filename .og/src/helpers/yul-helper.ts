import yulTemplate, { YulSection } from "../data/yul-template";

export const addToSection = (yul: string[], section: YulSection, lines: string[]): string[] => {
  const sectionIndex = yul.findIndex((line) => line.includes(`- ${section} -`));
  if (sectionIndex === -1) return yul;
  yul.splice(sectionIndex + 1, 0, ...lines);
  return yul;
};

export const getBaseYul = (name: string): string[] => {
  const base = [...yulTemplate];
  base.unshift(`object "${name}" {`);
  return base;
};
