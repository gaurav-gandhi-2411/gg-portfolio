"""Precompute the /work/triageiq retrieval-space projection.

NOT run in CI or at `next build` time. It reads the triage-iq repo's own gold
data and downloads BAAI/bge-base-en-v1.5 from Hugging Face, neither of which
CI has. Run manually, locally, whenever the corpus or the retriever changes;
the output is committed as a static asset
(content/data/triageiq-retrieval-projection.json) and read server-side.
Never computed client-side.

WHAT MAKES THIS THE REAL RETRIEVER AND NOT A LOOKALIKE, since that is the only
thing that makes the picture worth drawing:

  * Same model. `BAAI/bge-base-en-v1.5`, the value of `SUPPORTED_MODELS["bge"]`
    in triage-iq's `src/triage_iq/models/similar_issues.py`.
  * Same text construction. `f"{title}. " + body`, with the body truncated by
    token count against the model's own max_seq_length and two tokens reserved
    for [CLS]/[SEP] -- a port of that file's `_build_text`, not a re-invention.
  * Same asymmetry. BGE is trained with a query-side instruction and no
    document-side one, and triage-iq applies it per repo
    (`QUERY_INSTRUCTION_REPO_OVERRIDE`, ADR-0040) because it measured +6.67pp
    R@5 on kubernetes and a negative direction on vscode. kubernetes is the
    repo used here, so the instruction is ON for queries and OFF for the
    corpus, exactly as production does it.
  * Same similarity. L2-normalised embeddings compared by inner product, which
    is cosine. triage-iq uses faiss.IndexFlatIP for this; over a corpus this
    size a plain matmul gives bit-for-bit the same ranking without adding a
    faiss dependency to this repo.

WHAT IS DELIBERATELY DIFFERENT, stated here so nothing downstream has to guess:

  * The corpus is a sample, not the full one. CORPUS_SIZE issues drawn with a
    fixed seed from the kubernetes gold set's 6,612 unique issues. Retrieval
    ranks in the output are computed over THAT sample, so everything in the
    file is internally consistent -- and they are therefore NOT the production
    recall numbers, which are measured over the full corpus and live in
    content/metrics.json. Nothing here reports a recall figure, on purpose.
  * The 3D coordinates are t-SNE, and retrieval does not happen in them. The
    ranking is computed in the model's own 768 dimensions before any
    projection. Two points sitting next to each other in the picture are not
    necessarily each other's neighbours in the space, and the renderer draws
    retrieved neighbours by issue number rather than by proximity for exactly
    this reason.

Usage: python scripts/build_triageiq_retrieval_projection.py [--triage-iq-repo PATH]
Requires (local machine only): sentence-transformers, scikit-learn, numpy, pandas.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE

SEED = 42
MODEL_NAME = "BAAI/bge-base-en-v1.5"
# src/triage_iq/models/similar_issues.py's QUERY_INSTRUCTIONS["bge"], verbatim.
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
REPO = "kubernetes_kubernetes"
REPO_DISPLAY = "kubernetes/kubernetes"
# Set by what the STATIC layer costs, not by what the GL layer wants. Both
# layers draw the same corpus, and the static one is server-rendered SVG that
# every visitor receives before WebGL is offered, so each point is real bytes
# in the HTML for everyone. 700 keeps that in line with the Warmer viewer's
# existing 838 circles on the same kind of route, keeps the committed JSON
# near the hinglish projection's 41 KB, and still leaves the retrieval task
# non-trivial. Drawing 1,200 in GL and fewer in SVG was the obvious
# alternative and was rejected: two layers showing different corpora would
# make every rank true of one picture and not of the other.
CORPUS_SIZE = 700
N_CLUSTERS = 8
N_QUERIES = 6
TOP_K = 5
GOLD_RELPATH = "data/gold_related_v2.parquet"


def build_text(title: str, body: str, tokenizer: Any, max_tokens: int) -> str:
    """Port of triage-iq's `_build_text`, one row at a time.

    The title is never truncated and the body gets whatever token budget is
    left, minus two for the special tokens the BERT tokenizer adds.
    """
    prefix = f"{title}. "
    prefix_n_tokens = len(tokenizer.encode(prefix, add_special_tokens=False))
    body_budget = max(max_tokens - prefix_n_tokens - 2, 0)
    body_ids = tokenizer.encode(
        body or "", add_special_tokens=False, truncation=True, max_length=body_budget
    )
    return prefix + tokenizer.decode(body_ids, skip_special_tokens=True)


def load_issues(repo_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (issues, pairs) for this repo.

    `issues` is one row per distinct issue number with its title and body;
    `pairs` is the gold query -> related mapping the eval set is built from.
    """
    gold = pd.read_parquet(repo_path / GOLD_RELPATH)
    gold = gold[gold["repo"] == REPO].copy()
    if gold.empty:
        raise SystemExit(f"no rows for repo {REPO} in {GOLD_RELPATH}")

    queries = gold[["query_number", "query_title", "query_body"]].rename(
        columns={"query_number": "number", "query_title": "title", "query_body": "body"}
    )
    originals = gold[["original_number", "original_title", "original_body"]].rename(
        columns={"original_number": "number", "original_title": "title", "original_body": "body"}
    )
    issues = pd.concat([queries, originals], ignore_index=True)
    issues["number"] = issues["number"].astype(str)
    # An issue can appear many times across pairs; keep one row per number.
    issues = issues.drop_duplicates(subset=["number"], keep="first").reset_index(drop=True)
    issues["title"] = issues["title"].fillna("").astype(str)
    issues["body"] = issues["body"].fillna("").astype(str)

    pairs = gold[["query_number", "original_number"]].astype(str).drop_duplicates()
    return issues, pairs


def choose_corpus_and_queries(
    issues: pd.DataFrame, pairs: pd.DataFrame
) -> tuple[pd.DataFrame, list[tuple[str, str]]]:
    """Pick the sampled corpus and the query issues shown in the explainer.

    Every chosen query's own gold related issue is forced into the corpus, so a
    query whose answer was simply absent can never be presented as a miss.
    """
    rng = np.random.default_rng(SEED)
    # Queries whose gold partner is a different issue and where both have a
    # title, so the picture has something to name.
    titled = set(issues[issues["title"].str.len() > 10]["number"])
    usable = pairs[
        pairs["query_number"].isin(titled)
        & pairs["original_number"].isin(titled)
        & (pairs["query_number"] != pairs["original_number"])
    ]
    # One gold partner per query, deterministic pick.
    usable = usable.sort_values(["query_number", "original_number"])
    usable = usable.drop_duplicates(subset=["query_number"], keep="first")
    chosen_idx = rng.choice(len(usable), size=N_QUERIES, replace=False)
    chosen = [
        (str(usable.iloc[i]["query_number"]), str(usable.iloc[i]["original_number"]))
        for i in sorted(chosen_idx)
    ]

    forced = {n for pair in chosen for n in pair}
    rest = issues[~issues["number"].isin(forced)]
    take = max(CORPUS_SIZE - len(forced), 0)
    sample_idx = rng.choice(len(rest), size=min(take, len(rest)), replace=False)
    corpus = pd.concat(
        [issues[issues["number"].isin(forced)], rest.iloc[sorted(sample_idx)]], ignore_index=True
    )
    return corpus.reset_index(drop=True), chosen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--triage-iq-repo",
        type=Path,
        default=Path.home() / "ml-projects" / "triage-iq",
        help="path to the triage-iq checkout the gold data is read from",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent
        / "content"
        / "data"
        / "triageiq-retrieval-projection.json",
    )
    args = parser.parse_args()

    issues, pairs = load_issues(args.triage_iq_repo)
    print(f"{len(issues)} distinct issues, {len(pairs)} gold pairs in {REPO_DISPLAY}")

    corpus, chosen = choose_corpus_and_queries(issues, pairs)
    print(f"corpus sample: {len(corpus)} issues; {len(chosen)} query issues")

    model = SentenceTransformer(MODEL_NAME)
    max_tokens = model.max_seq_length
    tokenizer = model.tokenizer

    corpus_texts = [
        build_text(row.title, row.body, tokenizer, max_tokens) for row in corpus.itertuples()
    ]
    print(f"encoding {len(corpus_texts)} corpus texts (no query instruction, as production)")
    corpus_emb = model.encode(
        corpus_texts,
        batch_size=32,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    number_to_row = {n: i for i, n in enumerate(corpus["number"])}
    query_numbers = [q for q, _ in chosen]
    query_texts = [
        QUERY_INSTRUCTION + corpus_texts[number_to_row[n]] for n in query_numbers
    ]
    print(f"encoding {len(query_texts)} query texts (query instruction ON, kubernetes override)")
    query_emb = model.encode(
        query_texts,
        batch_size=8,
        show_progress_bar=False,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    # Cosine == inner product on normalised vectors, which is what
    # faiss.IndexFlatIP computes. Ranking happens here, in 768 dimensions,
    # before anything is projected.
    scores = query_emb @ corpus_emb.T

    print("projecting to 3D (t-SNE, seed 42)")
    coords = TSNE(
        n_components=3, perplexity=30, random_state=SEED, init="pca", max_iter=1000
    ).fit_transform(corpus_emb)
    coords = coords - coords.mean(axis=0)
    # Scale by a high percentile rather than the maximum. Dividing by the
    # single furthest point lets one outlier decide the zoom for all 700, and
    # the first version of this file did exactly that: the cloud rendered as a
    # small blob in the middle of its frame with the outer half of the box
    # empty. The 98th percentile fills the frame with the bulk of the corpus
    # and clips the handful of stragglers to the edge, which is the right
    # trade for a picture whose job is to show where the mass is.
    scale = float(np.percentile(np.abs(coords), 98))
    coords = np.clip(coords / scale, -1.0, 1.0)

    clusters = KMeans(n_clusters=N_CLUSTERS, random_state=SEED, n_init=10).fit_predict(corpus_emb)

    points: list[dict[str, Any]] = []
    for i, row in enumerate(corpus.itertuples()):
        points.append(
            {
                "n": row.number,
                "p": [round(float(c), 4) for c in coords[i]],
                "c": int(clusters[i]),
            }
        )

    queries_out: list[dict[str, Any]] = []
    for qi, (q_number, gold_number) in enumerate(chosen):
        q_row = number_to_row[q_number]
        row_scores = scores[qi].copy()
        # A query retrieving itself is not a result; production never has the
        # query already in its own index.
        row_scores[q_row] = -np.inf
        order = np.argsort(-row_scores)
        gold_row = number_to_row[gold_number]
        gold_rank = int(np.where(order == gold_row)[0][0]) + 1
        retrieved = []
        for rank, idx in enumerate(order[:TOP_K], start=1):
            retrieved.append(
                {
                    "n": str(corpus.iloc[idx]["number"]),
                    "title": str(corpus.iloc[idx]["title"])[:120],
                    "score": round(float(row_scores[idx]), 4),
                    "rank": rank,
                    "gold": bool(idx == gold_row),
                }
            )
        queries_out.append(
            {
                "n": q_number,
                "title": str(corpus.iloc[q_row]["title"])[:120],
                "gold": gold_number,
                "gold_title": str(corpus.iloc[gold_row]["title"])[:120],
                "gold_rank": gold_rank,
                "gold_in_top_k": gold_rank <= TOP_K,
                "retrieved": retrieved,
            }
        )
        print(f"  query #{q_number}: gold #{gold_number} ranked {gold_rank}")

    payload = {
        "version": 1,
        "model": MODEL_NAME,
        "query_instruction": QUERY_INSTRUCTION,
        "query_instruction_applies": "queries only, never the corpus (BGE is trained asymmetric)",
        "similarity": "inner product on L2-normalised embeddings, i.e. cosine, in 768 dimensions",
        "projection": (
            "t-SNE (sklearn), n_components=3, perplexity=30, init=pca, random_state=42 -- "
            "layout only; every rank in this file was computed before projection"
        ),
        "repo": REPO_DISPLAY,
        "corpus_size": len(corpus),
        "corpus_total": int(len(issues)),
        "n_clusters": N_CLUSTERS,
        "top_k": TOP_K,
        "source": (
            f"triage-iq/{GOLD_RELPATH} ({REPO_DISPLAY} rows) -- the same gold related-issue "
            "set the production eval is built from. Corpus here is a seed-42 sample of "
            f"{len(corpus)} of its {len(issues)} distinct issues, so ranks in this file are "
            "over the sample and are NOT the production recall figures."
        ),
        "generated_at": date.today().isoformat(),
        "points": points,
        "queries": queries_out,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = args.out.stat().st_size / 1024
    print(f"wrote {args.out} ({size_kb:.1f} KB, {len(points)} points, {len(queries_out)} queries)")


if __name__ == "__main__":
    main()
