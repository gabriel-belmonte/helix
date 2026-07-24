# Contributing to Helix

Thanks for your interest in contributing to Helix! This document covers everything you need to get started.

## Prerequisites

- [Bun](https://bun.sh/) >= 1.3.0 (runtime + package manager)
- Node.js 22 (for compatibility checks)
- Git

## Development setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/helix.git
cd helix

# 2. Install dependencies
bun install

# 3. Build all packages
bunx turbo run build

# 4. Run tests
bunx turbo run test
```

### Build individual packages

```bash
bunx turbo run build --filter=helix-agent      # agent engine only
bunx turbo run build --filter=helix-agent-cli   # CLI only
bunx turbo run build --filter=helix-agent-eval  # eval only
bunx turbo run build --filter=helix-site        # docs site only
```

### Compile the unified binary

```bash
bun build packages/cli/cli.ts --compile --outfile helix
./helix --version   # → v0.2.6
```

### Run a specific package's tests

```bash
cd packages/agent && bun test
cd packages/cli && bun test
cd packages/core && bun test
```

## Project structure

```
helix/
├── packages/
│   ├── agent/       → helix-agent     (npm SDK: engine + providers)
│   ├── core/        → helix-core      (internal: registry, plugins, web, auth)
│   ├── cli/         → helix binary    (compiled CLI + TUI + Dashboard)
│   ├── tui/         → Ink TUI         (bundled in CLI binary)
│   ├── web/         → Hono dashboard  (bundled in CLI binary)
│   ├── mcp/         → MCP client      (internal plugin)
│   ├── eval/        → A/B eval        (internal)
│   ├── memory/      → JSONL memory    (internal)
│   └── site/        → Astro docs      (GitHub Pages)
├── turbo.json       → task orchestration
└── package.json     → Bun workspace root
```

## Code style

- **TypeScript** with strict mode enabled (`tsconfig.base.json`).
- **ES modules** — `"type": "module"` in all packages. Use `import`/`export`, not `require`.
- **Target**: ES2022 with bundler module resolution.
- **Declarations**: All packages emit `.d.ts` files for consumers.
- **No linter/formatter enforced** — follow existing patterns in the codebase.

### Conventions

- Keep functions small and focused. The codebase philosophy is "readable over clever."
- Prefer explicit types over `any`. Use generics where appropriate.
- Tools are defined with `defineTool(name, description, handler)` — follow this pattern for new tools.
- Use `ctx.overrideTool(...)` in plugins to replace built-in modules.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling, or dependency changes |
| `perf` | Performance improvement |

### Scopes

Use the package name when the change is package-specific:

```
feat(agent): add streaming support for tool outputs
fix(cli): handle missing config gracefully
docs(site): update quick start guide
chore(ci): exclude site from test filter
```

### Examples

```
feat(core): add web_search module with SearXNG backend
fix(agent): prevent infinite loop on tool errors
refactor(mcp): simplify server connection lifecycle
test(eval): add LLM judge grading test cases
```

## Pull request process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes** with clear, focused commits.

3. **Build and test** before pushing:
   ```bash
   bunx turbo run build
   bunx turbo run test
   ```

4. **Push and open a PR** against `main`.

5. **CI must pass** — GitHub Actions runs build + test on every PR.

6. **Describe your changes** in the PR body. Link to any related issues.

7. **Request review** from a maintainer.

### What we look for in reviews

- Builds and tests pass
- No regressions in existing functionality
- Clear commit messages
- Tests added for new features
- Documentation updated if needed

## Testing

### Unit tests

```bash
# All packages
bunx turbo run test

# Single package
bunx turbo run test --filter=helix-agent
bunx turbo run test --filter=helix-agent-cli
bunx turbo run test --filter=helix-core

# Specific test file
cd packages/agent && bun test test/agent.test.ts
```

### Test conventions

- Tests use `bun:test` (Bun's built-in test runner).
- Test files live alongside source or in `test/` directories within each package.
- Use descriptive test names that explain the expected behavior.
- Mock external dependencies (LLM providers, file system) where appropriate.

### Integration tests

The CLI has integration tests that run the agent in scripted mode:

```bash
cd packages/cli && bun test
```

The `--scripted` flag uses a deterministic built-in LLM (no network, no API keys) — useful for testing.

## Adding a new package

1. Create the directory under `packages/`:
   ```bash
   mkdir -p packages/my-package/src
   ```

2. Add `package.json` with:
   - `"name": "helix-my-package"`
   - `"type": "module"`
   - `"scripts": { "build": "tsc", "test": "bun test" }`
   - Inherit `tsconfig.json` from `../../tsconfig.base.json`

3. Register in the root `package.json`:
   ```json
   "workspaces": ["packages/my-package"]
   ```

4. Add build/test tasks to `turbo.json` if needed.

## Adding a new tool

Tools are defined with `defineTool` from `helix-agent` and registered via the plugin system:

```typescript
import { defineTool } from "helix-agent";

export const myTool = defineTool(
  "my_tool",
  "Description of what this tool does",
  async (input: { param: string }) => {
    // Tool implementation
    return { result: "..." };
  }
);
```

Register it in the plugin system via `ctx.registerTool(myTool)`.

## Documentation

- Docs live in `packages/site/` (Astro + Starlight).
- English is the primary language; Spanish translations are in `packages/site/src/content/docs/es/`.
- Build docs locally:
  ```bash
  bunx turbo run build --filter=helix-site
  ```

## Getting help

- Open an issue on [GitHub](https://github.com/gabriel-belmonte/helix/issues)
- Check the [docs](https://gabriel-belmonte.github.io/helix/)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
