#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { refreshCommand } from "./commands/refresh.js";
import { statusCommand } from "./commands/status.js";
import { installHooks, removeHooks } from "./commands/hooks.js";

const program = new Command();

program
  .name("ai-cartographer")
  .description(
    "The README for AI agents. Generates semantic context maps for codebases."
  )
  .version("0.1.0");

program
  .command("init")
  .description("Generate a context map for the first time")
  .option("-v, --verbose", "Show detailed progress", false)
  .option("--free", "Use pattern-based descriptions only (no API key)", false)
  .option(
    "--dry-run",
    "Show file counts and cost estimate without scanning",
    false
  )
  .option("-o, --output <path>", "Output file path")
  .action(async (options) => {
    try {
      await initCommand(process.cwd(), options);
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("refresh")
  .description("Incrementally update the context map")
  .option("-v, --verbose", "Show detailed progress", false)
  .option("--free", "Use pattern-based descriptions only (no API key)", false)
  .option("-q, --quiet", "Minimal output (for git hooks)", false)
  .action(async (options) => {
    try {
      await refreshCommand(process.cwd(), options);
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show context map freshness and cache health")
  .action(async () => {
    try {
      await statusCommand(process.cwd());
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

const hooks = program.command("hooks").description("Manage git hooks");

hooks
  .command("install")
  .description("Install post-commit hook for auto-refresh")
  .action(() => {
    installHooks(process.cwd());
  });

hooks
  .command("remove")
  .description("Remove post-commit hook")
  .action(() => {
    removeHooks(process.cwd());
  });

program.parse();
