const addTabs = (yul: string[]) => {
  const tab = `    `;
  let indentation = 0;
  const yulWithTabs = [];
  for (const line of yul) {
    if (line === "}") indentation--;
    yulWithTabs.push(`${tab.repeat(indentation)}${line}`);
    if (line.slice(-1) === "{") indentation++;
  }
  return yulWithTabs;
};

const formatYul = (yul: string[]) => {
  const yulWithTabs = addTabs(yul);
  return yulWithTabs.join("\n");
};

export default formatYul;
