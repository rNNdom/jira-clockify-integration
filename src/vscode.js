import { spawn, execFileSync } from "node:child_process";

export function openVSCode(projectPath) {
  spawn("code", [projectPath], { detached: true, stdio: "ignore" }).unref();
}

export function setupNewFeatureBranch(projectPath, issueKey) {
  const git = (...args) =>
    execFileSync("git", ["-C", projectPath, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

  const currentBranch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
  const status = git("status", "--porcelain").trim();

  if (status) {
    return { ok: false, branch: currentBranch };
  }

  git("checkout", "develop");
  git("pull");
  const branch = `feature/${issueKey.toLowerCase()}`;
  git("checkout", "-b", branch);
  return { ok: true, branch };
}
