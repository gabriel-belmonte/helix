import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mdx from "@astrojs/mdx";

// GitHub Pages serves project repos under /<repo>/. Change to "/" if you use a
// custom domain or a user/org page (username.github.io).
export default defineConfig({
  base: "/helix",
  outDir: "dist",
  i18n: {
    // English by default; Spanish as a translation.
    defaultLocale: "en",
    locales: [
      { path: "en", codes: ["en-US", "en"] },
      { path: "es", codes: ["es-ES", "es"] },
    ],
  },
  integrations: [
    starlight({
      title: "Helix",
      description: "Minimal, transparent TypeScript agent framework — docs.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/gabriel-belmonte/helix" },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Introduction", link: "/helix/introduction/" },
            { label: "Quick start", link: "/helix/quickstart/" },
            { label: "Authentication & API keys", link: "/helix/authentication/" },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", link: "/helix/architecture/" },
            { label: "The web module", link: "/helix/web-module/" },
            { label: "Self-provisioning infra", link: "/helix/self-provisioning/" },
          ],
        },
        {
          label: "Integrations",
          items: [
            { label: "MCP (Model Context Protocol)", link: "/helix/mcp/" },
            { label: "Skills", link: "/helix/skills/" },
            { label: "Memory", link: "/helix/memory/" },
            { label: "Example: filesystem + Context7", link: "/helix/examples/filesystem-context7/" },
            { label: "Dashboard (Web)", link: "/helix/web-dashboard/" },
          ],
        },
        {
          label: "Extending Helix",
          items: [
            { label: "Plugin system", link: "/helix/plugins/" },
            { label: "Replace a module", link: "/helix/replace-module/" },
            { label: "Write your own module", link: "/helix/write-module/" },
          ],
        },
      ],
    }),
    mdx(),
  ],
});
