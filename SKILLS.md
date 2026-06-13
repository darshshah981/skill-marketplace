# SKILLS

This repo is the source of truth for my personal writing-and-thinking skill marketplace. Skills are versioned here; local install paths, symlinks, and tool wiring are left to each user's machine-specific setup.

## Canonical skills

- `resume-system` - resume, CV, and job-tailoring workflows.
- `knowledge-compiler` - turn research and reading into structured notes and links.
- `idea-intake` - capture, triage, and route raw ideas into the right store.
- `credibility-scaffold` - evidence, citations, and trust signals for claims.
- `draft-gate` - pre-publish checks that block weak drafts from shipping.
- `stylometry` - voice profiling and draft scoring against a voice card.

## Conventions

- Each skill lives in `skills/<name>/SKILL.md` and is self-contained.
- Tooling referenced by a skill lives alongside it (for example `tools/`) and is invoked by path, not by global install.
- Local install, symlinking into editors/agents, and PATH setup are the user's responsibility and intentionally out of scope for this repo.
