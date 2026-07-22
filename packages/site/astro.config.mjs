import { defineConfig } from "astro/config";

// GitHub Pages serves project repos under /<repo>/. Change to "/" if you use a
// custom domain or a user/org page (username.github.io).
export default defineConfig({
  base: "/helix",
  outDir: "dist",
});
