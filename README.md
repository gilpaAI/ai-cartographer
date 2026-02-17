# AI Cartographer

**The README for AI agents.** An open-source CLI tool that generates and maintains AI-optimized semantic context maps for codebases.

## The Problem

When AI coding agents enter a codebase, they're blind. They waste tokens reading random files to orient themselves, hallucinate paths that don't exist, and make edits in the wrong places. There's no standard way to tell an agent "this file handles JWT validation" vs "this file is a test fixture."

## The Solution

Cartographer generates a `.ai/context-map.md` file — a compressed semantic index of your entire repository. Not just file paths, but *what each file does*:

```
src/auth/utils.ts -> "Handles JWT validation, token refresh, and password hashing"
src/db/migrations/001.sql -> "Creates users table with email, role, and timestamp columns"
tests/auth.test.ts -> "Unit tests for authentication flow including edge cases"
```

## Features

- **Semantic indexing** — describes intent, not just structure
- **Hybrid analysis** — fast static parsing by default, optional AI-enrichment for deeper summaries
- **Auto-maintenance** — git hooks keep the map fresh on every commit
- **Token efficient** — 500-file project fits in ~4,000 tokens
- **Universal** — works with Cursor, Claude Code, Copilot, and any LLM tool
- **Zero config** — sensible defaults, works out of the box

## Quick Start

```bash
npx ai-cartographer init
```

## License

MIT
