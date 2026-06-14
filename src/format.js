export function printScan(scan, { json = false, verbose = false } = {}) {
  if (json) {
    console.log(JSON.stringify(scan, null, 2));
    return;
  }

  if (verbose) {
    printVerboseScan(scan);
    return;
  }

  const activeSkills = scan.skills.filter((skill) => !skill.overriddenBy);
  const projectSkills = activeSkills.filter((skill) => skill.scope === "project");
  const marketplaceSkills = activeSkills.filter((skill) => skill.scope === "marketplace");
  const globalSkills = activeSkills.filter((skill) => skill.scope === "global");
  const issues = scan.skills.flatMap((skill) => skill.issues.map((issue) => ({ skill, issue })));

  console.log(`Project: ${scan.projectRoot}`);
  if (scan.marketplaceRoot) console.log(`Marketplace: ${scan.marketplaceRoot}`);
  console.log("");

  if (!activeSkills.length) {
    console.log("No skills found.");
    return;
  }

  const projectTitle = scan.marketplaceRoot === scan.projectRoot ? "Marketplace skills in this repo" : "Project skills";
  printGroup(projectTitle, projectSkills);
  if (marketplaceSkills.length || scan.marketplaceRoot !== scan.projectRoot) {
    printGroup("Marketplace skills", marketplaceSkills);
  }
  printGroup("Global skills", globalSkills, { limit: 12 });

  if (issues.length) {
    console.log("");
    console.log("Issues:");
    for (const { skill, issue } of issues) console.log(`  ${skill.name}: ${issue}`);
  }

  console.log("");
  console.log("Try:");
  console.log("  skills plan <skill> --scope project --agent both");
  console.log("  skills install <skill> --scope project --agent both");
  console.log("");
  console.log("Use --verbose for paths and overrides, or --json for machine-readable output.");
}

function printVerboseScan(scan) {
  console.log(`cwd: ${scan.cwd}`);
  console.log(`project: ${scan.projectRoot}`);
  if (scan.marketplaceRoot) console.log(`marketplace: ${scan.marketplaceRoot}`);
  console.log("");

  for (const skill of scan.skills) {
    const status = skill.overriddenBy ? ` overridden by ${skill.overriddenBy}` : "";
    const issues = skill.issues.length ? ` issues: ${skill.issues.join("; ")}` : "";
    console.log(`${skill.name} [${skill.scope}] agents=${skill.agents.join(",")} path=${skill.root}${status}${issues}`);
  }
}

function printGroup(title, skills, { limit = Infinity } = {}) {
  console.log(`${title}: ${skills.length ? "" : "none"}`);
  const visible = skills.slice(0, limit);
  for (const skill of visible) {
    const description = skill.description ? ` - ${truncate(skill.description, 80)}` : "";
    console.log(`  ${skill.name.padEnd(24)} ${skill.agents.join(",")}${description}`);
  }
  if (skills.length > visible.length) {
    console.log(`  ... ${skills.length - visible.length} more. Use --verbose to show all.`);
  }
  console.log("");
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}...`;
}

export function printPlan(plan, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (!plan.skill) {
    console.log(plan.conflicts.join("\n"));
    return;
  }

  console.log(`skill: ${plan.skill.name}`);
  console.log(`source: ${plan.skill.root}`);
  console.log("");

  for (const action of plan.actions) {
    const marker = action.exists ? "conflict" : "ready";
    console.log(`${marker}: ${action.agent} ${action.scope} -> ${action.destination}`);
  }

  if (plan.conflicts.length) {
    console.log("");
    console.log("conflicts:");
    for (const conflict of plan.conflicts) console.log(`- ${conflict}`);
  }
}
