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
import { getUserInfo, getProjects, getTasks, startTimer, stopTimer } from "./clockify.js";
import { openVSCode, setupNewFeatureBranch } from "./vscode.js";

function prefixMatch(items, input, label) {
  const lower = input.toLowerCase();
  const exact = items.filter((i) => i.name.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];

  const matches = items.filter((i) => i.name.toLowerCase().startsWith(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    const names = items.map((i) => i.name).join(", ");
    console.error(`  ${label} "${input}" not found. Available: ${names}`);
    process.exit(1);
  }
  // Ambiguous — show conflicting matches so the user can narrow down
  const names = matches.map((i) => i.name).join(", ");
  console.error(`  ${label} "${input}" is ambiguous. Matches: ${names}`);
  process.exit(1);
}

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
  .option("--path <dir>", "Path to the project directory")
  .option("--new-feature", "Checkout develop, pull, and create feature/<issue-key> branch")
  .option("--project <name>", "Clockify project name to associate with the time entry")
  .option("--task <name>", "Clockify task name within the project (requires --project)")
  .action(async (issueKey, opts) => {
    issueKey = issueKey.toUpperCase();
    let projectPath = opts.path
      ? resolve(opts.path.replace(/^~/, homedir()))
      : undefined;

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

      let projectId, taskId;
      if (opts.project) {
        const projects = await getProjects(workspaceId);
        const project = prefixMatch(projects, opts.project, "Project");
        projectId = project.id;
        console.log(`  Project: ${project.name}`);

        if (opts.task) {
          const tasks = await getTasks(workspaceId, projectId);
          const task = prefixMatch(tasks, opts.task, "Task");
          taskId = task.id;
          console.log(`  Task: ${task.name}`);
        }
      } else if (opts.task) {
        console.error("  --task requires --project to be set");
        process.exit(1);
      }

      await startTimer(entryName, workspaceId, projectId, taskId);
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
