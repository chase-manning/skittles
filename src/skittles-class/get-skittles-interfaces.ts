import {
  forEachChild,
  InterfaceDeclaration,
  isInterfaceDeclaration,
  isPropertySignature,
  Node,
} from "typescript";
import { getNodeName } from "../helpers/ast-helper";
import {
  SkittlesInterface,
  SkittlesInterfaces,
  SkittlesParameter,
} from "../types/skittles-class";
import getSkittlesType from "./get-skittles-type";

const getElements = (node: InterfaceDeclaration): SkittlesParameter[] => {
  const { members } = node;
  if (!members) return [];
  const properties: SkittlesParameter[] = [];
  members.forEach((member) => {
    if (!isPropertySignature(member)) return;
    const { name, type } = member;
    if (!name || !type) return;
    properties.push({
      name: getNodeName(name),
      type: getSkittlesType(type, {}),
    });
  });
  return properties;
};

const getInterfaces = (node: Node): SkittlesInterface[] => {
  const interfaces: SkittlesInterface[] = [];
  forEachChild(node, (child) => {
    if (isInterfaceDeclaration(child)) {
      interfaces.push({
        name: getNodeName(child),
        elements: getElements(child),
      });
    } else interfaces.push(...getInterfaces(child));
  });
  return interfaces;
};

const getSkittlesInterfaces = (node: Node): SkittlesInterfaces => {
  const interfaces = getInterfaces(node);
  const skittlesInterfaces: SkittlesInterfaces = {};
  interfaces.forEach((i) => (skittlesInterfaces[i.name] = i));
  return skittlesInterfaces;
};

export default getSkittlesInterfaces;
