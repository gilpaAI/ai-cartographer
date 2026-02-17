import fs from "node:fs";
import path from "node:path";

const HOOK_MARKER = "# ai-cartographer auto-refresh";
const HOOK_CONTENT = `
${HOOK_MARKER}
ai-cartographer refresh --quiet 2>/dev/null || true
`;

export function installHooks(projectRoot: string): void {
  const hooksDir = path.join(projectRoot, ".git", "hooks");

  if (!fs.existsSync(hooksDir)) {
    console.log("❌ Not a git repository (no .git/hooks directory)");
    return;
  }

  const hookPath = path.join(hooksDir, "post-commit");

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf-8");

    if (existing.includes(HOOK_MARKER)) {
      console.log("✅ Hook already installed");
      return;
    }

    // Append to existing hook
    fs.appendFileSync(hookPath, "\n" + HOOK_CONTENT);
  } else {
    // Create new hook
    fs.writeFileSync(hookPath, "#!/bin/sh\n" + HOOK_CONTENT);
  }

  // Make executable
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Windows doesn't support chmod, but git handles it
  }

  console.log("✅ Post-commit hook installed");
  console.log("   Context map will auto-refresh after each commit");
}

export function removeHooks(projectRoot: string): void {
  const hookPath = path.join(projectRoot, ".git", "hooks", "post-commit");

  if (!fs.existsSync(hookPath)) {
    console.log("No post-commit hook found");
    return;
  }

  const content = fs.readFileSync(hookPath, "utf-8");

  if (!content.includes(HOOK_MARKER)) {
    console.log("No ai-cartographer hook found in post-commit");
    return;
  }

  // Remove our section
  const cleaned = content
    .split("\n")
    .filter((line) => {
      // Remove the marker line and the command line
      return !line.includes(HOOK_MARKER) && !line.includes("ai-cartographer refresh");
    })
    .join("\n")
    .trim();

  if (cleaned === "#!/bin/sh" || cleaned === "") {
    // Hook only had our content — remove the file
    fs.unlinkSync(hookPath);
    console.log("✅ Post-commit hook removed (file deleted — no other hooks)");
  } else {
    fs.writeFileSync(hookPath, cleaned + "\n");
    console.log("✅ ai-cartographer hook removed (other hooks preserved)");
  }
}
