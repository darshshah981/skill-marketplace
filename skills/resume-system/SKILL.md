---
name: resume-system
description: >
  Use this skill for all resume, CV, job-description, application-tailoring,
  resume-bullet, Kellogg-format, DOCX/PDF export, and final resume logging work
  for Darsh Shah in this vault. This vault-local skill is the canonical resume
  system and replaces separate resume-bullet-coach, resume-tailoring,
  kellogg-resume-update, and project-local resume-system behavior.
---

# Resume System

This is the canonical resume skill for Darsh Shah's vault. Use it for any resume
or job application work in `jobs-resume-studio/`. It consolidates the old
project-local resume-system skill plus the global bullet coach, tailoring, and
Kellogg-format resume skills.

Do not reach for another resume skill by default. Load the references below only
when their topic is needed.

## Default workflow

1. Parse the user's request and identify the target: edit, critique, tailor,
   export, QA, log, or library update.
2. Work in `jobs-resume-studio/` unless the user names another path.
3. Reuse first: search the resume vault, resume DB, master resume, source
   library, and prior tailored resumes before rewriting from scratch.
4. Keep claims grounded in existing evidence unless the user provides new facts.
5. Preserve Darsh's preferred framing: operator-builder, finance/product
   strategy, AI tooling, practical execution, and systems thinking.
6. For final one-page resumes, render DOCX/PDF when requested or implied, run
   layout QA, fix issues, and log the finalized variant.

## When to read references

- For paths, source files, folder conventions, and base-resume selection, read
  `references/source-map.md`.
- For JD scanning, tailoring strategy, multi-job handling, content matching, and
  experience discovery, read `references/tailoring-workflow.md`.
- For bullet critique, summary lines, project excavation, bullet ordering,
  recency balance, and weak-pattern diagnosis, read
  `references/bullet-coaching.md`.
- For Kellogg markdown format, renderer constraints, DOCX/PDF export, page-fit
  checks, orphan-tail checks, and completion logging, read
  `references/kellogg-format-export-qa.md`.

## Default one-page budget

- Current role: 3-4 bullets.
- Recent or highly relevant operating role: 3-5 bullets when aligned with the
  JD.
- MBA internship: 1-2 bullets.
- Older role: 1-2 bullets.
- Additional section: keep tight; include tools and side projects only when they
  support the target.

Override this when the role clearly rewards an older experience more than
recency.

## Style preferences

- Keep recruiter-facing copy concise, grounded, and specific.
- Do not make Darsh sound defensive about not being an engineer.
- Prefer operator-builder language: finance operator, product-adjacent builder,
  practical AI tooling, and systems thinker.
- Tailor role/designation titles to the reader when accurate. Reframe the
  domain named in the title to echo the target's world, but flag strong
  reframes for Darsh's sign-off.
- For agentic AI themes, Darsh prefers "agentic"; do not use "agent tech".
- For finance strategy roles, emphasize pricing, unit economics, forecast
  quality, planning cadence, executive decision support, SQL/data fluency, and
  cross-functional ownership.
- For product strategy roles, emphasize user/customer research, roadmap, PRDs,
  usage data, adoption, monetization, and cross-functional execution.

## Python requirement

For Python-related work in `jobs-resume-studio/`, follow `AGENTS.md`:

- Use a virtual environment.
- Prefer the repo-local `.venv/`.
- On Windows use `.venv/Scripts/python.exe` when available.
- On POSIX use `.venv/bin/python` when available.

## Stop rules

Ask the user before proceeding only when:

- a claim would require new facts not present in the repo or user message
- the resume cannot fit one page without cutting important content
- a role title or employment-date change could create accuracy risk
- export requires credentials, network access, or an unavailable GUI dependency

Otherwise, make the change, render or verify when appropriate, and report the
final paths.
