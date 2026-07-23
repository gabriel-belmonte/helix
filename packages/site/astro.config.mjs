import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mdx from "@astrojs/mdx";

// GitHub Pages serves project repos under /<repo>/. Change to "/" if you use a
// custom domain or a user/org page (username.github.io).
export default defineConfig({
  base: "/helix",
  outDir: "dist",
  // Absolute base URL — needed so the sitemap and canonical links are correct
  // on GitHub Pages (prevents 404s from malformed absolute URLs).
  site: "https://gabriel-belmonte.github.io",
  i18n: {
    // The default locale lives at the site root (/helix/). Spanish is under
    // /helix/es/. Starlight maps the "root" locale to src/content/docs/, so the
    // English home is /helix/ and the landing page is disabled.
    defaultLocale: "root",
    locales: [
      {
        path: "root",
        codes: ["en-US", "en"],
        label: "English",
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
          {
            label: "Operations",
            items: [
              { label: "Model evaluation (eval)", link: "/helix/eval/" },
              { label: "CLI reference", link: "/helix/cli/" },
            ],
          },
        ],
      },
      {
        path: "es",
        codes: ["es-ES", "es"],
        label: "Español",
        sidebar: [
          {
            label: "Empieza aquí",
            items: [
              { label: "Introducción", link: "/helix/es/" },
              { label: "Inicio rápido", link: "/helix/es/quickstart/" },
              { label: "Autenticación y claves API", link: "/helix/es/authentication/" },
            ],
          },
          {
            label: "Arquitectura",
            items: [
              { label: "Visión general", link: "/helix/es/architecture/" },
              { label: "El módulo web", link: "/helix/es/web-module/" },
              { label: "Infra auto-provisionada", link: "/helix/es/self-provisioning/" },
            ],
          },
          {
            label: "Integraciones",
            items: [
              { label: "MCP (Model Context Protocol)", link: "/helix/es/mcp/" },
              { label: "Skills", link: "/helix/es/skills/" },
              { label: "Memoria", link: "/helix/es/memory/" },
              { label: "Ejemplo: filesystem + Context7", link: "/helix/es/examples/filesystem-context7/" },
              { label: "Dashboard (Web)", link: "/helix/es/web-dashboard/" },
            ],
          },
          {
            label: "Extender Helix",
            items: [
              { label: "Sistema de plugins", link: "/helix/es/plugins/" },
              { label: "Reemplazar un módulo", link: "/helix/es/replace-module/" },
              { label: "Crea tu propio módulo", link: "/helix/es/write-module/" },
            ],
          },
          {
            label: "Operaciones",
            items: [
              { label: "Evaluación de modelos (eval)", link: "/helix/es/eval/" },
              { label: "Referencia de la CLI", link: "/helix/es/cli/" },
            ],
          },
        ],
      },
    ],
  },
  integrations: [
    starlight({
      title: "Helix",
      description: "Minimal, transparent TypeScript agent framework — docs.",
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/gabriel-belmonte/helix" },
        { icon: "heart", label: "Sponsor (Buy me a coffee)", href: "https://buymeacoffee.com/gabrielbelmonte" },
        { icon: "heart", label: "Sponsor (Ko-fi)", href: "https://ko-fi.com/gabrielbelmonte" },
      ],
    }),
    mdx(),
  ],
});
