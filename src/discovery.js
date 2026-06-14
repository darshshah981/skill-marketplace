import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".cache",
  ".venv",
  "__pycache__"
]);

export const AGENTS = ["codex", "claude"];

export function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

export function pathExists(inputPath) {
  try {
    fs.accessSync(inputPath);
    return true;
  } catch {
    return false;
  }
}

export function findProjectRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (pathExists(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

export function getGlobalRoots() {
  return [
    { root: path.join(os.homedir(), ".codex", "skills"), scope: "global", agentHint: "codex" },
    { root: path.join(os.homedir(), ".claude", "skills"), scope: "global", agentHint: "claude" }
  ];
}

export function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---")) return {};
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = markdown.slice(3, end).trim();
  const metadata = {};
  const lines = block.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (value === ">" || value === "|") {
      const continuation = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        continuation.push(lines[index + 1].trim());
        index += 1;
      }
      metadata[key] = continuation.join(value === ">" ? " " : "\n").trim();
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      metadata[key] = value
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      metadata[key] = value;
    }
  }

  return metadata;
}

export function inferAgents(metadata, skillRoot, agentHint) {
  const raw = metadata.agents || metadata.agent || metadata.targets || metadata.target;
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
  const normalized = values.map((value) => value.toLowerCase()).filter(Boolean);

  if (normalized.includes("both") || normalized.includes("all")) return [...AGENTS];
  const explicit = normalized.filter((value) => AGENTS.includes(value));
  if (explicit.length) return [...new Set(explicit)];

  const parts = skillRoot.split(path.sep);
  if (parts.includes(".codex")) return ["codex"];
  if (parts.includes(".claude")) return ["claude"];
  if (agentHint) return [agentHint];
  return [...AGENTS];
}

export function discoverSkillPackages(scanRoot, { scope = "project", agentHint = null } = {}) {
  const root = path.resolve(expandHome(scanRoot));
  if (!pathExists(root)) return [];

  const packages = [];

  function walk(current) {
    const entries = safeReadDir(current);
    const hasSkill = entries.some((entry) => entry.name === "SKILL.md" && entry.isFile());

    if (hasSkill) {
      packages.push(readSkillPackage(current, { root, scope, agentHint }));
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(current, entry.name));
    }
  }

  walk(root);
  return packages;
}

export function readSkillPackage(skillRoot, { root, scope, agentHint }) {
  const skillPath = path.join(skillRoot, "SKILL.md");
  const markdown = fs.readFileSync(skillPath, "utf8");
  const metadata = parseFrontmatter(markdown);
  const name = String(metadata.name || path.basename(skillRoot)).trim();
  const agents = inferAgents(metadata, skillRoot, agentHint);
  const assets = listCompanionAssets(skillRoot);

  return {
    name,
    description: String(metadata.description || "").trim(),
    root: skillRoot,
    relativeRoot: path.relative(root, skillRoot) || ".",
    skillPath,
    scope,
    agents,
    assets,
    sourceRoot: root,
    overriddenBy: null,
    issues: validateSkill({ name, skillPath, markdown, agents })
  };
}

export function listCompanionAssets(skillRoot) {
  const assets = [];
  for (const entry of safeReadDir(skillRoot)) {
    if (entry.name === "SKILL.md") continue;
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(skillRoot, entry.name);
    assets.push({
      name: entry.name,
      path: fullPath,
      kind: entry.isDirectory() ? "directory" : "file"
    });
  }
  return assets;
}

export function scanWorkspace({ cwd = process.cwd(), marketplaceRoot = null } = {}) {
  const projectRoot = findProjectRoot(cwd);
  const projectSkills = discoverSkillPackages(projectRoot, { scope: "project" });
  const globalSkills = getGlobalRoots().flatMap(({ root, scope, agentHint }) =>
    discoverSkillPackages(root, { scope, agentHint })
  );
  const normalizedMarketplaceRoot = marketplaceRoot ? path.resolve(marketplaceRoot) : null;
  const marketplaceSkills = normalizedMarketplaceRoot && normalizedMarketplaceRoot !== projectRoot
    ? discoverSkillPackages(marketplaceRoot, { scope: "marketplace" })
    : [];
  const skills = markOverrides([...globalSkills, ...projectSkills, ...marketplaceSkills]);

  return {
    cwd: path.resolve(cwd),
    projectRoot,
    globalRoots: getGlobalRoots().map((entry) => entry.root),
    marketplaceRoot: normalizedMarketplaceRoot,
    skills
  };
}

export function markOverrides(skills) {
  const rank = { global: 1, marketplace: 2, project: 3 };
  const groups = new Map();

  for (const skill of skills) {
    for (const agent of skill.agents) {
      const key = `${agent}:${skill.name}`;
      const current = groups.get(key);
      if (!current || rank[skill.scope] > rank[current.scope]) {
        groups.set(key, skill);
      }
    }
  }

  return skills.map((skill) => {
    const winners = skill.agents.map((agent) => groups.get(`${agent}:${skill.name}`)).filter(Boolean);
    const overriddenBy = winners.find((winner) => winner.root !== skill.root && rank[winner.scope] > rank[skill.scope]);
    return overriddenBy ? { ...skill, overriddenBy: overriddenBy.root } : skill;
  });
}

export function validateSkill({ name, skillPath, markdown, agents }) {
  const issues = [];
  if (!name) issues.push("missing skill name");
  if (!markdown.trim()) issues.push("empty SKILL.md");
  if (!agents.length) issues.push("no agent targets inferred");
  if (!path.basename(skillPath).match(/^SKILL\.md$/)) issues.push("entrypoint must be SKILL.md");
  return issues;
}

function safeReadDir(inputPath) {
  try {
    return fs.readdirSync(inputPath, { withFileTypes: true });
  } catch {
    return [];
  }
}
