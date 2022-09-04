import SkittlesContract from "../types/skittles-contract";

const addDependencies = (
  contract: SkittlesContract,
  classes: SkittlesContract[]
): SkittlesContract => {
  const dependencyClasses = classes.filter((c) => {
    return contract.classExtensions.includes(c.name);
  });
  if (dependencyClasses.length === 0) return contract;

  const { name, constructor, methods, interfaces, variables, classExtensions } =
    contract;

  dependencyClasses.forEach((dependencyClass) => {
    const {
      methods: dependencyMethods,
      interfaces: dependencyInterfaces,
      variables: dependencyVariables,
      classExtensions: dependencyClassExtensions,
    } = dependencyClass;
    Object.entries(dependencyInterfaces).forEach(([key, value]) => {
      if (!interfaces[key]) interfaces[key] = value;
    });
    methods.push(...dependencyMethods);
    variables.push(...dependencyVariables);
    classExtensions.push(...dependencyClassExtensions);
  });

  return {
    classExtensions,
    name,
    constructor,
    methods,
    interfaces,
    variables,
  };
};

export default addDependencies;
