# Phase 5: Distribution + DX Polish

Package dvx for global install and standalone binary distribution.
Add developer experience features.

## Status: Not Started

## Prerequisites

- [ ] Phase 4 complete (all features implemented)

## Deliverables

### npm Distribution

- [ ] Publish to npm as `dvx`
  - Verify name availability
  - Configure package.json for publishing (files, main, bin)
  - Add prepublishOnly script (build + test)
- [ ] `npm i -g dvx` works out of the box
- [ ] Post-install message with setup instructions

### Standalone Binary

- [ ] Build standalone binary via `bun compile` or `pkg`
  - No Node.js required on target machine
  - Single file output
- [ ] Binaries for: Linux x64, macOS arm64, macOS x64, Windows x64
- [ ] GitHub Releases with binary artifacts
- [ ] Installation script (curl | sh pattern for Linux/macOS)

### Init Wizard

- [ ] `dvx init` — guided setup
  - Walk through app registration creation in Entra ID
  - Create application user in Dataverse
  - Assign security role
  - Create auth profile
  - Validate connection
- [ ] Output step-by-step instructions for manual setup as fallback

### Shell Completion

- [ ] Bash completion
- [ ] Zsh completion
- [ ] PowerShell completion
- [ ] `dvx completion <shell>` command to output completion scripts

### Output Consistency

- [ ] `--output json` flag on ALL commands (machine-readable)
- [ ] `--output table` as default for interactive use
- [ ] `--output ndjson` where applicable (query, entities)
- [ ] Consistent error output format (JSON when `--output json`)

### MCP Transport

- [ ] HTTP/SSE transport for `dvx mcp` (in addition to stdio)
  - `--transport http --port <n>`
  - Enables remote deployment scenarios
- [ ] Health check endpoint

### Tests

- [ ] Init wizard: mock Entra + Dataverse APIs
- [ ] Shell completion: output validation
- [ ] Binary: smoke test on each platform (CI matrix)
- [ ] HTTP transport: connection, tool invocation, streaming

## Definition of Done

`npm i -g dvx` works, standalone binaries available on GitHub Releases,
`dvx init` walks through setup, shell completion for bash/zsh/PowerShell,
all output formats consistent, CI green on all platforms.
