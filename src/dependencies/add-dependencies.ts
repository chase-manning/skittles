import SkittlesClass from "../types/skittles-class";

const addDependencies = (
  skittlesClass: SkittlesClass,
  classes: SkittlesClass[]
): SkittlesClass => {
  const dependencyClasses = classes.filter((c) => {
    return skittlesClass.classExtensions.includes(c.name);
  });
  if (dependencyClasses.length === 0) return skittlesClass;

  const { name, constructor, methods, interfaces, variables, classExtensions } =
    skittlesClass;

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
