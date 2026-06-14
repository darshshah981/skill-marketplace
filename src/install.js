import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AGENTS, discoverSkillPackages, findProjectRoot } from "./discovery.js";

export function buildInstallPlan({ skillName, cwd, scope = "project", agent = "both", marketplaceRoot }) {
  const sourceSkills = discoverSkillPackages(marketplaceRoot, { scope: "marketplace" });
  const selected = sourceSkills.find((skill) => skill.name === skillName);
  if (!selected) {
    return {
      ok: false,
      actions: [],
      conflicts: [`Skill '${skillName}' was not found in ${marketplaceRoot}.`],
      skill: null
    };
  }

  const agents = normalizeAgents(agent).filter((target) => selected.agents.includes(target));
  const destinations = agents.map((target) => ({
    agent: target,
    path: destinationFor({ target, scope, cwd, skillName })
  }));

  const actions = destinations.map((destination) => ({
    type: "install",
    mode: "symlink-copy-fallback",
    skill: selected.name,
    source: selected.root,
    destination: destination.path,
    scope,
    agent: destination.agent,
    exists: fs.existsSync(destination.path)
  }));

  const conflicts = actions
    .filter((action) => action.exists)
    .map((action) => `Destination already exists for ${action.agent}: ${action.destination}`);

  return { ok: conflicts.length === 0, actions, conflicts, skill: selected };
}

export function applyInstallPlan(plan, { force = false } = {}) {
  if (!plan.ok && !force) {
    throw new Error(`Install plan has conflicts:\n${plan.conflicts.map((item) => `- ${item}`).join("\n")}`);
  }

  for (const action of plan.actions) {
    if (action.exists && !force) continue;
    if (action.exists && force) {
      const stat = fs.lstatSync(action.destination);
      if (stat.isSymbolicLink()) fs.unlinkSync(action.destination);
      else throw new Error(`Refusing to overwrite non-symlink destination: ${action.destination}`);
    }

    fs.mkdirSync(path.dirname(action.destination), { recursive: true });
    try {
      fs.symlinkSync(action.source, action.destination, "dir");
    } catch {
      copyDirectory(action.source, action.destination);
    }
  }
}

export function buildRemovePlan({ skillName, cwd, scope = "project", agent = "both" }) {
  const actions = normalizeAgents(agent).map((target) => {
    const destination = destinationFor({ target, scope, cwd, skillName });
    const exists = fs.existsSync(destination);
    const isSymlink = exists ? fs.lstatSync(destination).isSymbolicLink() : false;
    return {
      type: "remove",
      skill: skillName,
      destination,
      scope,
      agent: target,
      exists,
      isSymlink
    };
  });

  const conflicts = actions
    .filter((action) => action.exists && !action.isSymlink)
    .map((action) => `Refusing to remove non-symlink destination for ${action.agent}: ${action.destination}`);

  return { ok: conflicts.length === 0, actions, conflicts };
}

export function applyRemovePlan(plan) {
  if (!plan.ok) {
    throw new Error(`Remove plan has conflicts:\n${plan.conflicts.map((item) => `- ${item}`).join("\n")}`);
  }

  for (const action of plan.actions) {
    if (action.exists && action.isSymlink) fs.unlinkSync(action.destination);
  }
}

export function destinationFor({ target, scope, cwd, skillName }) {
  const projectRoot = findProjectRoot(cwd);
  if (scope === "global") {
    const base = target === "codex" ? ".codex" : ".claude";
    return path.join(os.homedir(), base, "skills", skillName);
  }

  const base = target === "codex" ? ".codex" : ".claude";
  return path.join(projectRoot, base, "skills", skillName);
}

export function normalizeAgents(agent) {
  if (!agent || agent === "both" || agent === "all") return [...AGENTS];
  const values = String(agent).split(",").map((item) => item.trim().toLowerCase());
  return values.filter((value) => AGENTS.includes(value));
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else fs.copyFileSync(sourcePath, destinationPath);
  }
}
