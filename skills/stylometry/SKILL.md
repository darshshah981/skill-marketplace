# stylometry

Profile a writer's voice from a corpus and score drafts against that voice.

## What it does

Two actions, both run via `tools/stylometry/profiler.py`:

- `build` - read a corpus of the writer's work and produce a voice card with rhythm, punctuation, function-word profile, richness, structure, and an AI-tell baseline.
- `score` - measure a draft against an existing voice card and report what is off in plain, actionable terms.

## When to use

- Building a voice fingerprint from a writing sample before drafting.
- Reviewing a draft to see whether it sounds like the writer, and where it drifts.
- Comparing drafts against multiple reference voices.

## Usage

```bash
# Build a voice card from a corpus
python tools/stylometry/profiler.py build "posts/*.md" --out voice_card.json --label essays

# Score a draft against a voice card
python tools/stylometry/profiler.py score path/to/draft.md --card voice_card.json

# Score from stdin
cat draft.md | python tools/stylometry/profiler.py score - --card voice_card.json
```

## Output

- `build` writes a JSON voice card capturing style features and the writer's baseline usage of common "AI-tell" words and phrases.
- `score` prints per-feature deltas and a plain-language summary of which features are off and by how much.

## Notes

- Zero-dependency Python; ships in this repo at `tools/stylometry/`.
- Interpretable by design: every reported number maps to something the writer can change.
- Use on a small corpus first; expand the corpus if the voice card feels unstable.
