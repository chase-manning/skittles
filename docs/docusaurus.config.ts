import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { URLS } from "./constants";

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
          href: URLS.website,
          label: "Website",
          position: "right",
        },
        {
          href: URLS.npm,
          label: "npm",
          position: "right",
        },
        {
          href: URLS.github,
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
              href: URLS.github,
            },
            {
              label: "npm",
              href: URLS.npm,
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Website",
              href: URLS.website,
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
