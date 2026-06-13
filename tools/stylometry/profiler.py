#!/usr/bin/env python3
"""
profiler.py — a stylometric "voice card" + draft scorer (zero-dependency).

This is the MEASUREMENT layer of the writing product. It does two things:

  build  — read a corpus of your writing and compute your voice fingerprint
           (rhythm, punctuation, function-word profile, richness, structure).
  score  — measure any draft against that fingerprint and report what's off,
           in plain, actionable terms ("sentences too long; too few em-dashes").

It is deliberately interpretable (not a black box): every number maps to
something you can change. Embedding-similarity (the holistic layer) comes later;
features come first because they're stable on a small corpus and tell you what to fix.

Usage:
  python profiler.py build "posts/*.md" [--out voice_card.json] [--label essays]
  python profiler.py score path/to/draft.md [--card voice_card.json]
  python profiler.py score -            # read draft text from stdin
"""
from __future__ import annotations

import argparse
import glob
import html
import json
import math
import re
import sys
from collections import Counter

# ---- a compact, standard English function-word set (topic-independent style signal) ----
FUNCTION_WORDS = set("""
a an the this that these those my your his her its our their
i me we us you he she it they them him
is are was were be been being am do does did doing have has had having
will would shall should can could may might must
and or but nor so yet for because although though while whereas if unless until since
of to in on at by with from into onto over under above below between among through during
about against around before after near off out up down within without
not no never only just even also too very more most less least much many few
as than then once here there where when why how what which who whom whose
i'm you're we're they're it's that's there's here's don't doesn't didn't isn't aren't
wasn't weren't can't won't wouldn't couldn't shouldn't i've you've we've i'll you'll
""".split())

FIRST_PERSON = set("i me my mine we us our ours i'm i've i'll i'd myself".split())
CONTRACTION = re.compile(r"\b\w+'(s|re|ve|ll|d|t|m)\b", re.I)

# words/phrases commonly flagged as "AI tells" — we measure YOUR baseline so a draft
# can be compared to how much you actually use them (not an absolute rule).
AI_TELL_WORDS = ["leverage", "delve", "paramount", "synergy", "robust", "tapestry",
                 "landscape", "realm", "pivotal", "underscore", "moreover", "furthermore",
                 "intricate", "nuanced", "seamless", "holistic", "elevate", "myriad",
                 "testament", "navigate", "foster", "crucial", "vibrant", "bustling"]
AI_TELL_PHRASES = ["in today's", "it's not just", "more than just", "in the realm of",
                   "in the world of", "when it comes to", "at the end of the day",
                   "the fact that", "it's important to note", "plays a (vital|key|crucial) role"]


def strip_markdown(text: str) -> str:
    """Reduce a markdown post to its prose: drop frontmatter, code, headers, links, etc."""
    # YAML frontmatter
    text = re.sub(r"^---\n.*?\n---\n", "", text, count=1, flags=re.S)
    # fenced code blocks
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    # images and links -> keep link text only
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    # inline code, emphasis markers, heading/quote/list markers
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"[*_#>]+", " ", text)
    text = re.sub(r"^\s*[-+]\s+", " ", text, flags=re.M)
    # bare urls
    text = re.sub(r"https?://\S+", " ", text)
    return text


def split_sentences(prose: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z\"'(])", prose.strip())
    return [s.strip() for s in parts if len(s.strip()) > 1]


def words_of(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text.lower())


def features(raw_md: str) -> dict | None:
    """Compute the stylometric feature vector for one document. None if too short."""
    structural = {
        "pull_quotes": len(re.findall(r"^\s*>", raw_md, flags=re.M)),
        "headers": len(re.findall(r"^\s*#{1,6}\s", raw_md, flags=re.M)),
        "bold": len(re.findall(r"\*\*[^*]+\*\*", raw_md)),
    }
    prose = strip_markdown(raw_md)
    sents = split_sentences(prose)
    words = words_of(prose)
    n_w = len(words)
    if n_w < 80:
        return None
    slens = [len(words_of(s)) for s in sents if words_of(s)]
    paras = [p for p in re.split(r"\n\s*\n", strip_markdown(raw_md)) if words_of(p)]
    sents_per_para = [len(split_sentences(p)) for p in paras] or [0]
    counts = Counter(words)
    per_k = lambda c: round(1000 * c / n_w, 2)
    longw = sum(1 for w in words if len(w) >= 7)

    def punct(ch):
        return raw_md.count(ch)

    text_lower = raw_md.lower()
    tell_words = sum(text_lower.count(w) for w in AI_TELL_WORDS)
    tell_phrases = sum(len(re.findall(p, text_lower)) for p in AI_TELL_PHRASES)

    return {
        "words": n_w,
        "sentences": len(slens),
        "sent_len_mean": round(sum(slens) / len(slens), 2) if slens else 0,
        "sent_len_median": sorted(slens)[len(slens) // 2] if slens else 0,
        "sent_len_stdev": round(_stdev(slens), 2),
        "pct_short_sent": round(100 * sum(1 for x in slens if x <= 8) / len(slens), 1) if slens else 0,
        "pct_long_sent": round(100 * sum(1 for x in slens if x >= 25) / len(slens), 1) if slens else 0,
        "sents_per_para": round(sum(sents_per_para) / len(sents_per_para), 2),
        "emdash_per_k": per_k(raw_md.count("—") + raw_md.count(" - ")),
        "semicolon_per_k": per_k(punct(";")),
        "colon_per_k": per_k(punct(":")),
        "paren_per_k": per_k(punct("(")),
        "question_per_k": per_k(punct("?")),
        "exclaim_per_k": per_k(punct("!")),
        "first_person_pct": round(100 * sum(counts[w] for w in FIRST_PERSON) / n_w, 2),
        "contraction_per_k": per_k(len(CONTRACTION.findall(raw_md))),
        "type_token_ratio": round(len(counts) / n_w, 3),
        "hapax_pct": round(100 * sum(1 for c in counts.values() if c == 1) / len(counts), 1),
        "long_word_pct": round(100 * longw / n_w, 1),
        "func_word_pct": round(100 * sum(counts[w] for w in FUNCTION_WORDS) / n_w, 1),
        "ai_tell_per_k": per_k(tell_words + tell_phrases),
        **{f"struct_{k}": v for k, v in structural.items()},
        "_funcprofile": {w: counts[w] for w in FUNCTION_WORDS if counts[w]},
    }


def _stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def build(patterns, label):
    files = [f for pat in patterns for f in glob.glob(pat)]
    docs, used = [], []
    funcagg = Counter()
    total_w = 0
    for f in files:
        try:
            raw = open(f, encoding="utf-8").read()
        except OSError:
            continue
        feat = features(raw)
        if feat:
            docs.append(feat)
            used.append(f)
            for w, c in feat.pop("_funcprofile").items():
                funcagg[w] += c
            total_w += feat["words"]
    if not docs:
        raise SystemExit("No documents with enough prose found.")
    keys = [k for k in docs[0] if not k.startswith("struct_") and not k.startswith("_")]
    card = {"label": label, "doc_count": len(docs), "total_words": total_w, "files": used,
            "features": {}, "func_signature": {}}
    for k in keys:
        vals = [d[k] for d in docs]
        card["features"][k] = {"mean": round(sum(vals) / len(vals), 2),
                               "stdev": round(_stdev(vals), 2)}
    for k in ("struct_pull_quotes", "struct_headers", "struct_bold"):
        vals = [d[k] for d in docs]
        card["features"][k + "_per_post"] = {"mean": round(sum(vals) / len(vals), 2),
                                             "stdev": round(_stdev(vals), 2)}
    top = funcagg.most_common(25)
    card["func_signature"] = {w: round(1000 * c / total_w, 2) for w, c in top}
    return card


URL_RE = re.compile(r"https?://\S+|t\.co/\S+|pic\.twitter\.com/\S+")


def load_tweets(path):
    """Extract substantive tweet texts from a Spiral samples JSON export."""
    data = json.load(open(path, encoding="utf-8"))
    items = data if isinstance(data, list) else next((v for v in data.values() if isinstance(v, list)), [])
    out = []
    for it in items:
        c = (it.get("content") if isinstance(it, dict) else str(it)) or ""
        c = URL_RE.sub(" ", html.unescape(c)).strip()
        if len(re.findall(r"[A-Za-z']+", c)) >= 4:   # drop url-only / emoji-only / fragments
            out.append(c)
    return out


def build_tweets(path, label, chunks=10):
    """Build a scoreable voice card for the short-text (tweet) register.

    Tweets are too short to feature individually, so we pool them into ~10
    chunks → real per-1k rates plus genuine cross-chunk stdevs (so it can gate)."""
    tweets = load_tweets(path)
    if len(tweets) < chunks:
        chunks = max(1, len(tweets))
    size = math.ceil(len(tweets) / chunks)
    groups = [tweets[i:i + size] for i in range(0, len(tweets), size)]
    docs, funcagg, total_w = [], Counter(), 0
    for g in groups:
        feat = features("\n\n".join(g))
        if not feat:
            continue
        for w, c in feat.pop("_funcprofile").items():
            funcagg[w] += c
        total_w += feat["words"]
        docs.append(feat)
    if not docs:
        raise SystemExit("Not enough tweet text to profile.")
    keys = [k for k in docs[0] if not k.startswith("struct_") and not k.startswith("_")]
    card = {"label": label, "register": "tweets", "tweet_count": len(tweets),
            "chunk_count": len(docs), "total_words": total_w, "features": {}, "func_signature": {}}
    for k in keys:
        vals = [d[k] for d in docs]
        card["features"][k] = {"mean": round(sum(vals) / len(vals), 2), "stdev": round(_stdev(vals), 2)}
    lengths = [len(re.findall(r"[A-Za-z']+", t)) for t in tweets]
    card["tweet_rhythm"] = {
        "avg_words": round(sum(lengths) / len(lengths), 1),
        "median_words": sorted(lengths)[len(lengths) // 2],
        "stdev_words": round(_stdev(lengths), 1),
        "pct_under_15w": round(100 * sum(1 for x in lengths if x < 15) / len(lengths), 1),
    }
    card["func_signature"] = {w: round(1000 * c / total_w, 2) for w, c in funcagg.most_common(25)}
    return card


def render_card(card):
    f = card["features"]
    g = lambda k: f[k]["mean"]
    L = []
    unit = f"{card['doc_count']} docs" if card.get("doc_count") else f"{card.get('tweet_count', '?')} tweets"
    L.append(f"VOICE CARD — {card['label']}  ({unit}, {card['total_words']:,} words)")
    L.append("=" * 62)
    L.append("RHYTHM")
    L.append(f"  sentence length:   {g('sent_len_mean')} avg  (median {g('sent_len_median')}, "
             f"stdev {g('sent_len_stdev')})  ← variance = your long/short mix")
    L.append(f"  short (<=8w):      {g('pct_short_sent')}%      long (>=25w): {g('pct_long_sent')}%")
    L.append(f"  sentences/para:    {g('sents_per_para')}        ← your 'short paragraph' habit")
    L.append("PUNCTUATION  (per 1,000 words)")
    L.append(f"  em-dash {g('emdash_per_k')}   semicolon {g('semicolon_per_k')}   colon {g('colon_per_k')}   "
             f"parens {g('paren_per_k')}   '?' {g('question_per_k')}   '!' {g('exclaim_per_k')}")
    L.append("VOICE")
    L.append(f"  first-person:      {g('first_person_pct')}%       contractions: {g('contraction_per_k')}/1k")
    L.append(f"  function words:    {g('func_word_pct')}%       long words(>=7): {g('long_word_pct')}%")
    L.append("RICHNESS")
    L.append(f"  type/token: {g('type_token_ratio')}    hapax: {g('hapax_pct')}%")
    if card.get("tweet_rhythm"):
        r = card["tweet_rhythm"]
        L.append("TWEET RHYTHM")
        L.append(f"  words/tweet: {r['avg_words']} avg (median {r['median_words']}, stdev {r['stdev_words']}); "
                 f"{r['pct_under_15w']}% under 15 words")
    else:
        L.append("STRUCTURE  (per post)")
        L.append(f"  pull-quotes {f.get('struct_pull_quotes_per_post', {}).get('mean', 0)}   headers "
                 f"{f.get('struct_headers_per_post', {}).get('mean', 0)}   bold {f.get('struct_bold_per_post', {}).get('mean', 0)}")
    L.append("AI-TELL BASELINE")
    L.append(f"  your tell-word rate: {g('ai_tell_per_k')}/1k  ← drafts above this sound less like you")
    L.append("TOP FUNCTION-WORD SIGNATURE (per 1k): " +
             ", ".join(f"{w} {r}" for w, r in list(card["func_signature"].items())[:12]))
    return "\n".join(L)


def score(text_md, card):
    feat = features(text_md)
    if not feat:
        raise SystemExit("Draft too short to score (need ~80+ words).")
    feat.pop("_funcprofile", None)
    f = card["features"]
    watch = ["sent_len_mean", "sent_len_stdev", "pct_long_sent", "sents_per_para",
             "emdash_per_k", "first_person_pct", "func_word_pct", "ai_tell_per_k"]
    rows, zsum, zn = [], 0.0, 0
    for k in watch:
        mean, sd = f[k]["mean"], max(f[k]["stdev"], 1e-6)
        z = (feat[k] - mean) / sd
        zsum += abs(z); zn += 1
        flag = "ok" if abs(z) < 1 else ("HIGH" if z > 0 else "LOW")
        rows.append((k, feat[k], mean, round(z, 2), flag))
    composite = round(zsum / zn, 2)
    L = [f"DRAFT SCORE vs '{card['label']}'  (lower = closer; composite z-dist {composite})", "-" * 60]
    L.append(f"{'feature':18} {'draft':>8} {'you':>8} {'z':>6}  flag")
    for k, dv, mv, z, flag in rows:
        L.append(f"{k:18} {dv:>8} {mv:>8} {z:>6}  {flag}")
    tips = []
    fd = dict((r[0], r) for r in rows)
    if fd["sent_len_mean"][3] > 1: tips.append("shorten sentences — you write punchier")
    if fd["sent_len_stdev"][3] < -1: tips.append("vary sentence length — mix long with one-line punches")
    if fd["emdash_per_k"][3] < -1: tips.append("you use em-dashes more than this")
    if fd["first_person_pct"][3] < -1: tips.append("more first-person — your voice is personal")
    if fd["ai_tell_per_k"][3] > 1: tips.append("cut tell-words (leverage/landscape/robust/…)")
    if tips:
        L.append(""); L.append("FIX: " + "; ".join(tips))
    return "\n".join(L)


def main(argv=None):
    for s in (sys.stdout, sys.stderr):
        try: s.reconfigure(encoding="utf-8")
        except Exception: pass
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build"); b.add_argument("patterns", nargs="+")
    b.add_argument("--out", default="voice_card.json"); b.add_argument("--label", default="corpus")
    bt = sub.add_parser("build-tweets"); bt.add_argument("json")
    bt.add_argument("--out", default="voice_card.tweets.json"); bt.add_argument("--label", default="tweets")
    sc = sub.add_parser("score"); sc.add_argument("file"); sc.add_argument("--card", default="voice_card.json")
    a = ap.parse_args(argv)
    if a.cmd == "build":
        card = build(a.patterns, a.label)
        json.dump(card, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(render_card(card)); print(f"\n[saved → {a.out}]")
    elif a.cmd == "build-tweets":
        card = build_tweets(a.json, a.label)
        json.dump(card, open(a.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(render_card(card)); print(f"\n[saved → {a.out}]")
    else:
        text = sys.stdin.read() if a.file == "-" else open(a.file, encoding="utf-8").read()
        card = json.load(open(a.card, encoding="utf-8"))
        print(score(text, card))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
