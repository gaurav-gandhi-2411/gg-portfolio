"""Precompute the hero/case-study embedding-cloud projection.

NOT run in CI or at `next build` time -- it depends on the private `mindmeld`
repo (for the real term vocabulary) and downloads the actual
gauravgandhi2411/hinglish-relatedness-sbert model from Hugging Face, neither
of which CI has access to. Run manually, locally, whenever the vocabulary or
model changes; the output is committed as a static asset
(content/data/hinglish-embedding-projection.json) and read server-side by
the Next.js hero/case-study components. Never computed client-side.

Vocabulary is the real term set actually used in mindmeld's production eval
(generator/evals/finetune/data/bakeoff_raw/gauravgandhi2411__hinglish-relatedness-sbert.json's
dim1_records/dim2_records secret/word pairs) -- the terms real users' guesses
were scored against, not a placeholder word list.

Usage: python scripts/build_embedding_projection.py [--mindmeld-repo PATH]
Requires (local machine only): sentence-transformers, scikit-learn, numpy.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.manifold import TSNE

SEED = 42
N_CLUSTERS = 7
FIXTURE_RELPATH = (
    "generator/evals/finetune/data/bakeoff_raw/"
    "gauravgandhi2411__hinglish-relatedness-sbert.json"
)


def load_terms(mindmeld_repo: Path) -> list[str]:
    fixture_path = mindmeld_repo / FIXTURE_RELPATH
    with fixture_path.open(encoding="utf-8") as f:
        data = json.load(f)
    terms: set[str] = set()
    for r in data["dim1_records"]:
        terms.add(r["secret"])
        terms.add(r["word"])
    for r in data["dim2_records"]:
        terms.add(r["en_secret"])
        terms.add(r["hien_secret"])
    return sorted(terms)


def project(model_name: str, terms: list[str]) -> tuple[np.ndarray, np.ndarray]:
    model = SentenceTransformer(model_name)
    embeddings = model.encode(terms, normalize_embeddings=True, show_progress_bar=True)
    tsne = TSNE(
        n_components=3,
        random_state=SEED,
        perplexity=30,
        init="pca",
        learning_rate="auto",
    )
    coords = tsne.fit_transform(embeddings)
    # Center and scale to a fixed, reproducible [-1, 1]-ish range for the 3D scene.
    coords = coords - coords.mean(axis=0)
    coords = coords / np.abs(coords).max()
    return coords, embeddings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mindmeld-repo",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "mindmeld",
        help="Path to a local mindmeld checkout (default: ../mindmeld relative to this repo)",
    )
    args = parser.parse_args()

    terms = load_terms(args.mindmeld_repo)
    print(f"{len(terms)} unique terms")

    # B1 (ambient homepage hero) only needs the fine-tuned model's projection.
    # B2 (the /work/warmer base-vs-finetuned toggle) is a separate, later PR
    # -- it will add the base model's projection to this same file when that
    # work starts, not before.
    coords_ft, emb_ft = project("gauravgandhi2411/hinglish-relatedness-sbert", terms)

    km = KMeans(n_clusters=N_CLUSTERS, random_state=SEED, n_init=10).fit(emb_ft)
    clusters = km.labels_.tolist()

    points = [
        {
            "term": term,
            "cluster": int(clusters[i]),
            "finetuned": [round(float(v), 4) for v in coords_ft[i]],
        }
        for i, term in enumerate(terms)
    ]

    payload = {
        "version": 1,
        "model": "gauravgandhi2411/hinglish-relatedness-sbert",
        "projection": "t-SNE (sklearn), n_components=3, perplexity=30, random_state=42",
        "n_terms": len(terms),
        "n_clusters": N_CLUSTERS,
        "source": (
            "mindmeld/" + FIXTURE_RELPATH + " (dim1_records + dim2_records secret/word "
            "vocabulary) -- real production eval terms, not placeholder data"
        ),
        "generated_at": "2026-08-12",
        "points": points,
    }

    out_dir = Path(__file__).resolve().parents[1] / "content" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "hinglish-embedding-projection.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
