import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "introduction",
    {
      type: "category",
      label: "Getting Started",
      items: ["getting-started/installation", "getting-started/quick-start"],
    },
    {
      type: "category",
      label: "Guide",
      items: [
        "guide/types",
        "guide/state-variables",
        "guide/functions",
        "guide/events-and-errors",
        "guide/control-flow",
        "guide/inheritance",
        "guide/evm-globals",
        "guide/cross-file",
        "guide/testing",
        "guide/configuration",
        "guide/under-the-hood",
      ],
    },
    {
      type: "category",
      label: "CLI Reference",
      items: ["cli/index"],
    },
    {
      type: "category",
      label: "Examples",
      items: ["examples/erc20-token", "examples/staking-contract"],
    },
  ],
};

export default sidebars;
