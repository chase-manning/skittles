import { YulSection } from "../data/yul-template";
import { addToSection } from "../helpers/yul-helper";

const addObjects = (contract: string, yul: string[], yuls: Record<string, string[]>) => {
  const contracts = Object.keys(yuls).filter((key) => key !== contract);
  const yulObjects = contracts.map((name) => yuls[name]);

  for (let i = 0; i < yulObjects.length; i++) {
    yul = addToSection(yul, YulSection.Objects, yulObjects[i]);
    const objectName = contracts[i];
    const deploymentFunction = [
      `function deployContract${objectName}() -> addr {`,
      `datacopy(0, dataoffset("${objectName}"), datasize("${objectName}"))`,
      `addr := create(0, 0, datasize("${objectName}"))`,
      `if iszero(addr) { revert(0, 0) }`,
      `}`,
    ];
    yul = addToSection(yul, YulSection.Deployments, deploymentFunction);
    yul = addToSection(yul, YulSection.ConstructorDeployments, deploymentFunction);
    yul = [...yul, "", "IR:", "", ...yulObjects[i]];
  }

  return yul;
};

export default addObjects;
