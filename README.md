# Skill Marketplace

A personal, Git-tracked marketplace for reusable Codex and Claude Code skills.

This repo is the source of truth. Clone it on each machine, sync changes with
Git, and use the bundled `skills` CLI to scan, plan, install, update, and publish
skills.

## Layout

- `SKILLS.md` - canonical skill index
- `skills/` - reusable skill packages
- `tools/` - supporting utilities such as stylometry
- `bin/skills.js` - CLI entrypoint
- `src/` - installer implementation

## CLI

Run from the marketplace checkout:

```bash
node ./bin/skills.js scan
node ./bin/skills.js doctor
node ./bin/skills.js plan idea-intake --scope project --agent both
node ./bin/skills.js install idea-intake --scope project --agent both
```

After packaging or linking the repo, the same commands become:

```bash
skills scan
skills install idea-intake --scope global --agent codex
```

## Discovery Model

The installer scans recursively. A skill package is any directory containing a
`SKILL.md`; everything beside it, such as `tools/`, `references/`, `examples/`,
or manifest files, travels with that skill.

For project skills, the CLI starts at the current working directory and walks
upward to the nearest `.git` directory. That nearest Git root is the project
scope. If you are working in a subfolder, you still use the parent repo's project
skills. A nested Git repo gets its own project scope.

Global skills are read from:

```text
~/.codex/skills
~/.claude/skills
```

Resolution precedence is:

```text
project skills > marketplace skills > global skills
```

Agent-specific skills win for their agent when metadata or path layout indicates
`codex` or `claude`; otherwise a skill is treated as shared and installable for
both.

## Install Model

`install` always performs a scan and prints a plan before writing. Use `--yes` to
accept the plan non-interactively.

Project installs write adapters into:

```text
<project-root>/.codex/skills/<skill-name>
<project-root>/.claude/skills/<skill-name>
```

Global installs write adapters into:

```text
~/.codex/skills/<skill-name>
~/.claude/skills/<skill-name>
```

The installer tries a symlink first and falls back to copying the skill package
if symlinks are unavailable.

## Commands

- `skills scan` - recursively discover project, marketplace, and global skills
- `skills list` - alias for `scan`
- `skills doctor` - show validation issues
- `skills plan <skill>` - show install destinations and conflicts
- `skills install <skill>` - scan, validate, plan, confirm, then install
- `skills update` - scan, confirm, then `git pull --ff-only`
- `skills publish` - show status, confirm, then `git push`
- `skills diff` - show marketplace Git diff
- `skills remove` - remove symlinked installs; non-symlink folders are refused
