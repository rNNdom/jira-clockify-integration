#!/usr/bin/env node

import { resolve } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { program } from "commander";
import { config } from "dotenv";

// Load ~/.workstartrc first, then local .env as fallback
config({ path: resolve(homedir(), ".workstartrc") });
config();

import { getJiraIssue, addWorklog } from "./jira.js";
import { getUserInfo, startTimer, stopTimer } from "./clockify.js";
import { openVSCode, setupNewFeatureBranch } from "./vscode.js";

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

program
  .name("workstart")
  .description("Start working on a Jira task with Clockify time tracking.")
  .argument("<issue-key>", "Jira issue key (e.g. AURORE-123)")
  .argument("[project-path]", "Path to the project directory")
  .option("--new-feature", "Checkout develop, pull, and create feature/<issue-key> branch")
  .action(async (issueKey, projectPath, opts) => {
    issueKey = issueKey.toUpperCase();
    if (projectPath) {
      projectPath = resolve(projectPath.replace(/^~/, homedir()));
    }

    // --- Jira --------------------------------------------------------
    console.log(`  Fetching ${issueKey} from Jira...`);
    let issue;
    try {
      issue = await getJiraIssue(issueKey);
    } catch (err) {
      console.error(`  Failed to fetch Jira issue: ${err.message}`);
      process.exit(1);
    }

    const title = issue.fields.summary;
    const entryName = `[${issueKey}]: ${title}`;
    console.log(`  ${entryName}`);

    if (projectPath) {
      // --- Git (optional) ----------------------------------------------
      if (opts.newFeature) {
        console.log("  Setting up feature branch...");
        const result = setupNewFeatureBranch(projectPath, issueKey);
        if (result.ok) {
          console.log(`  Branch ${result.branch} created`);
        } else {
          console.warn(`  Could not checkout develop, staying on ${result.branch}`);
        }
      }

      // --- VS Code -----------------------------------------------------
      console.log(`  Opening VS Code at ${projectPath}`);
      openVSCode(projectPath);
    }

    // --- Clockify ----------------------------------------------------
    console.log("  Starting Clockify timer...");
    let workspaceId, userId;
    try {
      const user = await getUserInfo();
      workspaceId = user.activeWorkspace;
      userId = user.id;
      await startTimer(entryName, workspaceId);
    } catch (err) {
      console.error(`  Failed to start timer: ${err.message}`);
      process.exit(1);
    }

    const startedAt = Date.now();
    console.log();
    console.log(`  Timer running since ${new Date(startedAt).toLocaleTimeString()}`);
    console.log("  Press Enter or Ctrl+C to stop.\n");

    // --- Wait & stop -------------------------------------------------
    let stopped = false;

    const handleStop = async () => {
      if (stopped) return;
      stopped = true;
      console.log("\n  Stopping timer...");
      try {
        await stopTimer(workspaceId, userId);
      } catch (err) {
        console.error(`  Failed to stop timer: ${err.message}`);
        process.exit(1);
      }
      const elapsedMs = Date.now() - startedAt;
      const duration = formatDuration(elapsedMs);
      console.log(`  Tracked ${duration} on ${entryName}`);

      const timeSpentSeconds = Math.floor(elapsedMs / 1000);
      if (timeSpentSeconds >= 60) {
        console.log("  Logging time to Jira...");
        try {
          await addWorklog(issueKey, timeSpentSeconds);
          console.log("  Worklog added to Jira.");
        } catch (err) {
          console.error(`  Failed to log time to Jira: ${err.message}`);
        }
      }

      console.log("  Done!");
      process.exit(0);
    };

    process.on("SIGINT", handleStop);
    process.on("SIGTERM", handleStop);

    const rl = createInterface({ input: process.stdin });
    rl.once("line", handleStop);
    rl.once("close", handleStop);
  });

program.parse();
