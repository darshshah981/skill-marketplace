export function printScan(scan, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(scan, null, 2));
    return;
  }

  console.log(`cwd: ${scan.cwd}`);
  console.log(`project: ${scan.projectRoot}`);
  if (scan.marketplaceRoot) console.log(`marketplace: ${scan.marketplaceRoot}`);
  console.log("");

  if (!scan.skills.length) {
    console.log("No skills found.");
    return;
  }

  for (const skill of scan.skills) {
    const status = skill.overriddenBy ? ` overridden by ${skill.overriddenBy}` : "";
    const issues = skill.issues.length ? ` issues: ${skill.issues.join("; ")}` : "";
    console.log(`${skill.name} [${skill.scope}] agents=${skill.agents.join(",")} path=${skill.root}${status}${issues}`);
  }
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
