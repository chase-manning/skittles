import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Skittles Docs",
  tagline: "Write smart contracts with TypeScript",
  favicon: "img/favicon.png",

  future: {
    v4: true,
  },

  url: "https://docs.skittles.dev",
  baseUrl: "/",

  organizationName: "chase-manning",
  projectName: "skittles",

  onBrokenLinks: "throw",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/chase-manning/skittles/tree/main/docs/",
          routeBasePath: "/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/og-image.png",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      logo: {
        alt: "Skittles Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://skittles.dev",
          label: "Website",
          position: "right",
        },
        {
          href: "https://www.npmjs.com/package/skittles",
          label: "npm",
          position: "right",
        },
        {
          href: "https://github.com/chase-manning/skittles",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/getting-started/installation",
            },
            {
              label: "Guide",
              to: "/guide/types",
            },
            {
              label: "CLI Reference",
              to: "/cli",
            },
            {
              label: "Examples",
              to: "/examples/erc20-token",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/chase-manning/skittles",
            },
            {
              label: "npm",
              href: "https://www.npmjs.com/package/skittles",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Website",
              href: "https://skittles.dev",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Skittles. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["solidity", "bash", "json", "typescript"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
