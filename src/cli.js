import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { scanWorkspace } from "./discovery.js";
import { applyInstallPlan, applyRemovePlan, buildInstallPlan, buildRemovePlan } from "./install.js";
import { printPlan, printScan } from "./format.js";

const COMMANDS = new Set(["scan", "list", "plan", "install", "update", "publish", "diff", "remove", "doctor", "help"]);

export async function main(argv) {
  const { command, positionals, options } = parseArgs(argv);
  const marketplaceRoot = resolveMarketplaceRoot(options);
  const cwd = path.resolve(options.cwd || process.cwd());

  switch (command) {
    case "scan":
    case "list":
      printScan(scanWorkspace({ cwd, marketplaceRoot }), { json: options.json });
      break;
    case "doctor":
      runDoctor({ cwd, marketplaceRoot, json: options.json });
      break;
    case "plan":
      printPlan(makePlan(positionals, options, cwd, marketplaceRoot), { json: options.json });
      break;
    case "install":
      await runInstall(positionals, options, cwd, marketplaceRoot);
      break;
    case "update":
      await runUpdate(options, marketplaceRoot);
      break;
    case "publish":
      await runPublish(options, marketplaceRoot);
      break;
    case "diff":
      runGit(["diff", "--stat"], marketplaceRoot);
      runGit(["diff"], marketplaceRoot);
      break;
    case "remove":
      await runRemove(positionals, options, cwd);
      break;
    case "help":
    default:
      printHelp();
  }
}

function makePlan(positionals, options, cwd, marketplaceRoot) {
  const skillName = positionals[0];
  if (!skillName) throw new Error("Missing skill name. Example: skills plan idea-intake");
  return buildInstallPlan({
    skillName,
    cwd,
    scope: options.scope || "project",
    agent: options.agent || "both",
    marketplaceRoot
  });
}

async function runInstall(positionals, options, cwd, marketplaceRoot) {
  const scan = scanWorkspace({ cwd, marketplaceRoot });
  const plan = makePlan(positionals, options, cwd, marketplaceRoot);

  if (options.json) {
    console.log(JSON.stringify({ scan, plan }, null, 2));
    return;
  }

  printScan(scan);
  console.log("");
  printPlan(plan);
  console.log("");

  if (!plan.ok && !options.force) {
    throw new Error("Install stopped because the plan has conflicts. Re-run with --force only for symlink destinations you intend to replace.");
  }

  if (!options.yes && !options.force) {
    const confirmed = await confirm("Install this plan?");
    if (!confirmed) {
      console.log("No changes made.");
      return;
    }
  }

  applyInstallPlan(plan, { force: options.force });
  console.log("Install complete.");
}

async function runUpdate(options, marketplaceRoot) {
  const scan = scanWorkspace({ cwd: process.cwd(), marketplaceRoot });
  printScan(scan, { json: options.json });
  if (options.json) return;

  if (!options.yes && !options.force) {
    const confirmed = await confirm("Pull latest marketplace changes?");
    if (!confirmed) {
      console.log("No changes made.");
      return;
    }
  }

  runGit(["pull", "--ff-only"], marketplaceRoot);
}

async function runPublish(options, marketplaceRoot) {
  runGit(["status", "--short"], marketplaceRoot);
  if (!options.yes && !options.force) {
    const confirmed = await confirm("Push current branch to origin?");
    if (!confirmed) {
      console.log("No changes made.");
      return;
    }
  }
  runGit(["push"], marketplaceRoot);
}

async function runRemove(positionals, options, cwd) {
  const skillName = positionals[0];
  if (!skillName) throw new Error("Missing skill name. Example: skills remove idea-intake");
  const plan = buildRemovePlan({
    skillName,
    cwd,
    scope: options.scope || "project",
    agent: options.agent || "both"
  });

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  for (const action of plan.actions) {
    const marker = action.exists ? (action.isSymlink ? "ready" : "conflict") : "missing";
    console.log(`${marker}: ${action.agent} ${action.scope} -> ${action.destination}`);
  }

  if (!plan.ok) {
    throw new Error("Remove stopped because one or more destinations are not symlinks.");
  }

  if (!options.yes && !options.force) {
    const confirmed = await confirm("Remove these symlinked installs?");
    if (!confirmed) {
      console.log("No changes made.");
      return;
    }
  }

  applyRemovePlan(plan);
  console.log("Remove complete.");
}

function runDoctor({ cwd, marketplaceRoot, json }) {
  const scan = scanWorkspace({ cwd, marketplaceRoot });
  const issues = scan.skills.flatMap((skill) =>
    skill.issues.map((issue) => ({ skill: skill.name, path: skill.root, issue }))
  );

  if (json) {
    console.log(JSON.stringify({ ...scan, issues }, null, 2));
    return;
  }

  printScan(scan);
  console.log("");
  if (!issues.length) {
    console.log("Doctor found no skill issues.");
    return;
  }
  console.log("Doctor issues:");
  for (const issue of issues) console.log(`- ${issue.skill}: ${issue.issue} (${issue.path})`);
}

function runGit(args, cwd) {
  const result = childProcess.spawnSync("git", args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
}

async function confirm(question) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
}

function resolveMarketplaceRoot(options) {
  const explicit = options.marketplace || process.env.SKILLS_MARKETPLACE_ROOT;
  if (explicit) return path.resolve(explicit);

  let current = path.dirname(new URL(import.meta.url).pathname);
  while (true) {
    if (fs.existsSync(path.join(current, "SKILLS.md")) && fs.existsSync(path.join(current, "skills"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

function parseArgs(argv) {
  const command = COMMANDS.has(argv[0]) ? argv[0] : "help";
  const rest = command === "help" && argv[0] && !COMMANDS.has(argv[0]) ? argv : argv.slice(1);
  const options = {};
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (["json", "yes", "force"].includes(key)) {
      options[key] = true;
    } else {
      options[key] = inlineValue ?? rest[++index];
    }
  }

  return { command, positionals, options };
}

function printHelp() {
  console.log(`skills - personal skill marketplace installer

Usage:
  skills scan [--json] [--cwd <path>] [--marketplace <path>]
  skills list [--json]
  skills doctor [--json]
  skills plan <skill> [--scope project|global] [--agent codex|claude|both] [--json]
  skills install <skill> [--scope project|global] [--agent codex|claude|both] [--yes] [--force]
  skills remove <skill> [--scope project|global] [--agent codex|claude|both] [--yes]
  skills update [--yes]
  skills publish [--yes]
  skills diff

Install always scans and prints a plan before writing. Project installs target the nearest .git root.`);
}
