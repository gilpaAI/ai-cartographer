import path from "node:path";
import type { FileEntry } from "./discovery.js";

/**
 * Generate pattern-based descriptions without any API calls.
 * Used with --free flag.
 */
export function generateFreeDescriptions(
  files: FileEntry[]
): Map<string, string> {
  const descriptions = new Map<string, string>();

  for (const file of files) {
    descriptions.set(file.relativePath, inferDescription(file));
  }

  return descriptions;
}

function inferDescription(file: FileEntry): string {
  const basename = path.basename(file.relativePath);
  const ext = file.extension;
  const dir = path.dirname(file.relativePath);
  const nameNoExt = path.basename(file.relativePath, ext);

  // Test files
  if (
    basename.includes(".test.") ||
    basename.includes(".spec.") ||
    basename.includes("_test.") ||
    dir.includes("__tests__")
  ) {
    return `Tests for ${nameNoExt.replace(/\.(test|spec)/, "").replace(/_test/, "")}`;
  }

  // Index/entry files
  if (nameNoExt === "index" || nameNoExt === "main" || nameNoExt === "mod") {
    return `Entry point for ${path.basename(dir)} module`;
  }

  // Migration files
  if (dir.includes("migration")) {
    return "Database migration";
  }

  // Route files
  if (dir.includes("route") || dir.includes("router")) {
    return `Route definitions for ${nameNoExt}`;
  }

  // Component files
  if (dir.includes("component")) {
    return `${capitalize(nameNoExt)} UI component`;
  }

  // Hook files
  if (nameNoExt.startsWith("use")) {
    return `${capitalize(nameNoExt)} React hook`;
  }

  // Middleware
  if (dir.includes("middleware")) {
    return `${capitalize(nameNoExt)} middleware`;
  }

  // Config files
  if (basename.includes("config") || basename.includes("rc")) {
    return `Configuration for ${nameNoExt}`;
  }

  // Type definition files
  if (basename.includes("types") || basename.includes("interfaces")) {
    return `Type definitions for ${path.basename(dir)}`;
  }

  // README
  if (nameNoExt.toUpperCase() === "README") {
    return dir === "." ? "Project documentation" : `Documentation for ${path.basename(dir)}`;
  }

  // Fallback: derive from filename and directory
  const context = dir !== "." ? ` in ${path.basename(dir)}` : "";
  return `${capitalize(nameNoExt)}${context}`;
}

function capitalize(s: string): string {
  // Convert kebab-case and snake_case to readable form
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
