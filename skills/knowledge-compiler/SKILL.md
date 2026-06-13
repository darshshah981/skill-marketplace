---
name: knowledge-compiler
description: Compile and maintain a bounded markdown research workspace inside the vault. Use when the user wants an LLM-managed knowledge base, durable topic wiki, source-digest set, concept map, integrity pass, or reusable synthesis over a scoped corpus of notes, clippings, repos, memos, or articles. Trigger for requests to initialize, ingest, compile, query, lint, promote, merge, or refresh a research workspace rather than summarize one file or search the whole vault.
---

# Knowledge Compiler

Operate as a compiler for topic-scoped knowledge work.

Treat the vault as three layers:

- Canonical source notes: existing files in places like `clippings/`, `references/`, `ideas/`, `work memos/`. Read these, but do not modify them during normal operation.
- Active research workspaces: `research/<topic-slug>/`. This is the main writable layer for compilation.
- Shared promoted knowledge: `knowledge/concepts/`. Update this only during explicit promote or merge operations.

Use the compiler metaphor explicitly. The primary operations are:

- `initialize`
- `ingest`
- `query`
- `lint`
- `promote`
- `merge`
- `refresh`

If the user asks for vague whole-vault compilation, refuse and propose narrower workspace candidates instead.

## Core Operating Model

Treat `research/<topic-slug>/` as the unit of compilation. Each workspace should contain:

```text
research/<topic-slug>/
  WORKSPACE.md
  index.md
  log.md
  health-check.md
  sources/
  concepts/
  outputs/
  raw/            # optional, only when localized copies are useful
```

If a topic is not yet bounded, help define one before writing files.

Shared concepts live at:

```text
knowledge/concepts/
```

Do not create or update shared concepts during ordinary ingest. Only touch them during explicit `promote` or `merge` work.

## Trust Boundaries

Follow these rules strictly:

- Do not modify canonical source notes during normal compiler operations.
- Freely maintain compiler-owned files inside the active workspace.
- Only edit `knowledge/concepts/` during explicit promote or merge operations.
- Preserve contradictions instead of flattening them into a single story.
- Keep provenance visible. Compiler-owned files should point back to source notes or source digests.
- Prefer local concepts first. Promote only when reuse is earned.

## Confidence Model

Use a lightweight action model based on confidence:

- High confidence: update local compiler-owned files directly.
- Medium confidence: update local files, but note uncertainty, rationale, or tension in the file.
- Low confidence: do not make the structural change. Record it in `health-check.md` or ask the user.

Do not pretend to have precise numeric confidence. Use operational judgment.

## Scope Selection

Support three scope modes:

- Explicit: the user gives exact files or folders.
- Seed-and-expand: the user gives a topic or a few seed notes and you propose a bounded corpus.
- Refresh-existing: the workspace already exists and you update from its current inventory.

When starting from topic name alone, propose the candidate corpus and let the user confirm or redirect it before heavy compilation.

When scope is too broad, refuse to compile until it narrows. Offer 2-4 concrete candidates from the vault when possible.

## Operation Rules

### Initialize

Use when creating a new workspace.

Do the minimum viable setup:

- create `research/<topic-slug>/`
- create `WORKSPACE.md`
- create `index.md`
- create `log.md`
- create `health-check.md`
- create `sources/`, `concepts/`, and `outputs/`
- create `raw/` only if the user explicitly wants localized copies or the workspace clearly benefits from self-contained assets

Read [references/workspace-charter-template.md](references/workspace-charter-template.md) when drafting `WORKSPACE.md`.
Read [references/compiler-templates.md](references/compiler-templates.md) before creating compiler-owned files.

During initialization, propose:

- what is in scope
- what is out of scope
- what the workspace is trying to answer
- what outputs would be valuable

### Ingest

Use when adding a new source or refreshing local synthesis from new evidence.

Default behavior:

- read the new or changed source note
- update or create a source digest under `sources/`
- update or create local concept pages under `concepts/`
- update `index.md`
- append to `log.md`
- run a lightweight health pass

Ingest may create new local concepts when there is clear support, but do not create shared concepts here.

If a source contradicts an existing concept:

- preserve the disagreement explicitly
- update the relevant local concept's tensions/conflicts section
- note the issue in `health-check.md`
- if the contradiction affects a shared concept, suggest a later promote/merge review instead of rewriting the shared concept during ingest

### Query

Use when answering questions against the workspace.

Do not assume every answer should become a file. Classify the result:

- Ephemeral: answer in chat only.
- Durable output: save under `outputs/`.
- Promotable synthesis: save under `outputs/` and suggest follow-on updates or promotion candidates.

Default to ephemeral unless the answer is clearly reusable, synthesizes multiple sources, or the user asks to save it.

When saving outputs, link back to the source digests and concepts used.

### Lint

Use for structural review and maintenance.

Run lightweight lint after meaningful ingest/update operations:

- missing digest links
- likely duplicate concepts
- contradiction flags
- promotion candidates

Run deeper lint on explicit command:

- coverage gaps
- unsupported claims
- stale outputs
- ontology drift
- local/shared merge opportunities
- promising next sources or questions

### Promote

Use when local concepts have earned promotion into `knowledge/concepts/`.

Promotion is suggested by the skill, but should happen only on explicit command.

A concept is a good promotion candidate when at least two of these are true:

- it appears materially in 2 or more workspaces
- it has support from multiple source digests
- it is being reused in outputs or writing
- duplicate local versions are starting to drift
- it is likely to remain useful beyond the current project

When promoting:

- create or update `knowledge/concepts/<slug>.md`
- log the workspace origins and rationale
- do not silently overwrite an existing shared concept; perform an explicit merge
- convert the local concept page into a topic-specific application page that links to the shared concept and retains only local nuance

### Merge

Use when local concepts overlap heavily, or when a shared concept already exists and a promotion candidate needs reconciliation.

Behavior:

- merge when confidence is high
- if ambiguity is material, flag it in `health-check.md` instead of forcing the merge
- do not silently delete useful distinctions
- prefer aliasing or local-application rewrites over aggressive consolidation

### Refresh

Use when a workspace already exists and new evidence, changed priorities, or recent queries require an incremental update.

Refresh should reuse the current workspace inventory and structure rather than rebuilding from scratch.

## File Ownership and Structure

Be highly structured for files this skill owns. Be minimally opinionated about canonical source notes it only reads.

Use balanced frontmatter for compiler-owned files:

- `type`
- `topic`
- `status`
- `created`
- `updated`
- `source_notes`
- `derived_from`
- `confidence`

Use additional type-specific fields only when useful:

- local concepts: `shared_concept`
- shared concepts: `workspace_origins`
- outputs: `output_kind`
- source digests: `source_url` or canonical path

Read [references/compiler-templates.md](references/compiler-templates.md) for the default file templates.

## Writing System Integration

Treat research as upstream of writing.

When a workspace produces a strong thesis or reusable frame:

- suggest promotion into `ideas/`
- link the relevant workspace and output notes
- optionally prepare a draft scaffold if that helps the user's existing writing workflow

Do not draft directly into `posts/` by default. Feed the downstream writing workflow instead of bypassing it.

## Navigation and Retrieval

For v1, rely primarily on:

- `index.md`
- explicit links
- ordinary file search

Do not require embeddings or custom retrieval infrastructure up front. If a workspace becomes hard to scan, note that as a future tooling opportunity rather than assuming it from the start.

## Invocation Style

Expect natural-language commands with an explicit workspace target.

Typical prompts:

- `Use knowledge-compiler to initialize research/agent-wiki from these three notes.`
- `Ingest this clipping into research/agent-wiki.`
- `Query research/agent-wiki: what are the strongest arguments against this model?`
- `Lint research/agent-wiki.`
- `Promote reusable concepts from research/agent-wiki.`
- `Merge promotion candidates for agent-memory in research/agent-wiki.`
- `Refresh research/agent-wiki after these two new memos.`

## First-Pass Bias

When a workspace is new, do the minimum viable compilation:

- bound the scope
- create the workspace
- inventory the source set
- compile the top source digests
- create the first useful local concepts
- establish `index.md`, `log.md`, and `health-check.md`

Do not over-abstract an immature corpus.
