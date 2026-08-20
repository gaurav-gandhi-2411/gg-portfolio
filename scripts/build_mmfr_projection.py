"""Precompute the /work/multimodal-fashion-recommender item-space projection.

NOT run in CI or at `next build` time. It loads the real trained checkpoint
(checkpoints/best.pt, gitignored in the product repo, never committed here),
runs the real frozen CLIP + SBERT encoders and the real trained ItemTower over
a real brand catalogue, and writes the output as a static asset
(content/data/mmfr-projection.json), read server-side. Never computed
client-side. Run manually, locally, whenever the catalogue or the checkpoint
changes.

WHAT MAKES THIS THE REAL ITEM TOWER AND NOT A LOOKALIKE, since that is the
only thing that makes the picture worth drawing:

  * Same image encoder. open_clip ViT-B-32, pretrained="openai" -- exactly
    config.yaml's encoders.image_model/image_pretrained, loaded the same way
    src/encoders/image_encoder.py's ImageEncoder does (encode_image, L2
    normalize).
  * Same text encoder. sentence-transformers/all-MiniLM-L6-v2, config.yaml's
    encoders.text_model. Text input is "{title}. {description}", the same
    shape src/encoders/text_encoder.py builds from a catalogue row.
  * Same fusion. checkpoints/best.pt's own item_tower.* weights loaded
    directly into a real ItemTower(image_dim=512, text_dim=384, hidden=512,
    output_dim=256) via TwoTowerModel.load_state_dict -- concat, MLP,
    L2-normalize, identical to spaces/src/models/item_tower.py's forward().
  * Same neighbor metric. Cosine similarity (inner product on L2-normalized
    256-dim vectors) over the real fused embeddings, before any projection --
    the same metric FaissRetriever's IndexFlatIP computes.

WHAT IS DELIBERATELY DIFFERENT, stated here so nothing downstream has to
guess:

  * The catalogue is one real brand (Snitch), not the H&M training set the
    model was trained on. This is the exact "day-one, no purchase history"
    scenario the case study's own "Honest caveat: new-brand personalization"
    result already names -- the item tower needs no retraining to run on a
    catalogue it never trained on, since only the fusion MLP over frozen
    image/text encoders is being exercised, not anything catalogue-specific.
  * The 3D coordinates are t-SNE, and neighbor ranking does not happen in
    them. Ranking is computed in the model's own 256 dimensions before any
    projection. Two points sitting next to each other in the picture are not
    necessarily each other's nearest neighbours, and the renderer draws
    neighbours by product id rather than by proximity for exactly this
    reason (same discipline as scripts/build_triageiq_retrieval_projection.py).
  * Category is the real catalogue field (Shirts/T-Shirts/Trousers/...), not
    a KMeans cluster over the embedding -- more honest than an algorithmic
    proxy when a real label already exists.
  * This checkpoint's own training-time val_recall_at_10 (epoch 11: 0.0406,
    stored in best.pt's own metrics dict) differs from the case study's
    reported test-set Recall@10 (0.0328, content/provenance.md's mmfr:recall10).
    Different splits -- validation during training vs. a held-out temporal
    test set -- not a contradiction, and not what this script measures either
    way: it draws embedding geometry, not ranking accuracy.

Usage: python scripts/build_mmfr_projection.py [--mmfr-repo PATH] [--brand snitch]
Requires (local machine only, the mmfr repo's own .venv has all of these):
open_clip_torch, sentence-transformers, torch, scikit-learn, numpy, pandas,
pillow, requests, pyyaml.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests
import torch
import torch.nn as nn
import yaml
from PIL import Image
from sklearn.manifold import TSNE

SEED = 42
IMAGE_MODEL = "ViT-B-32"
IMAGE_PRETRAINED = "openai"
TEXT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
BRAND = "snitch"
# 500 items total (10 categories x 50), all used -- small enough to encode
# and download in one run, matches TriageIQ's precedent of "a few hundred,
# not the whole corpus" for a committed-JSON explainer.
N_ANCHORS = 6
TOP_K = 5
IMAGE_TIMEOUT_S = 12


class ItemTower(nn.Module):
    """Verbatim copy of spaces/src/models/item_tower.py's forward shape --
    duplicated rather than imported, since this script does not add the mmfr
    repo's own src/ package to sys.path for anything except the checkpoint
    file and config.yaml, both plain data."""

    def __init__(self, image_dim=512, text_dim=384, hidden=512, output_dim=256, dropout=0.2):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(image_dim + text_dim, hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, output_dim),
        )

    def forward(self, image_emb: torch.Tensor, text_emb: torch.Tensor) -> torch.Tensor:
        x = torch.cat([image_emb, text_emb], dim=-1)
        x = self.mlp(x)
        return torch.nn.functional.normalize(x, dim=-1)


def load_catalogue(mmfr_repo: Path, brand: str) -> pd.DataFrame:
    path = mmfr_repo / "data" / brand / "catalog.csv"
    df = pd.read_csv(path)
    df["title"] = df["title"].fillna("").astype(str)
    df["description"] = df["description"].fillna("").astype(str)
    return df.reset_index(drop=True)


def download_images(df: pd.DataFrame, cache_dir: Path) -> list[Path | None]:
    """Downloads each row's image_url once, cached to disk by product_id so a
    re-run after a code change does not re-fetch 500 images. Returns None for
    a row whose image could not be fetched -- the caller zeroes that row's
    image embedding, matching image_encoder.py's own missing-image contract.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path | None] = []
    session = requests.Session()
    n_downloaded = 0
    n_cached = 0
    n_failed = 0
    for row in df.itertuples():
        ext = ".jpg"
        local = cache_dir / f"{row.product_id}{ext}"
        if local.exists() and local.stat().st_size > 0:
            paths.append(local)
            n_cached += 1
            continue
        try:
            resp = session.get(row.image_url, timeout=IMAGE_TIMEOUT_S)
            resp.raise_for_status()
            local.write_bytes(resp.content)
            paths.append(local)
            n_downloaded += 1
        except Exception as exc:  # noqa: BLE001 -- one bad image must not abort 500
            print(f"  WARN: image fetch failed for {row.product_id}: {exc}", file=sys.stderr)
            paths.append(None)
            n_failed += 1
    print(f"images: {n_cached} cached, {n_downloaded} downloaded, {n_failed} failed")
    return paths


def encode_images(paths: list[Path | None], device: torch.device) -> np.ndarray:
    import open_clip

    model, _, preprocess = open_clip.create_model_and_transforms(
        IMAGE_MODEL, pretrained=IMAGE_PRETRAINED
    )
    model.to(device).eval()

    embs = np.zeros((len(paths), 512), dtype=np.float32)
    batch_imgs, batch_idx = [], []

    def flush():
        if not batch_imgs:
            return
        with torch.no_grad():
            batch = torch.stack(batch_imgs).to(device)
            out = model.encode_image(batch)
            out = out / out.norm(dim=-1, keepdim=True)
            out = out.cpu().float().numpy()
        for j, idx in enumerate(batch_idx):
            embs[idx] = out[j]
        batch_imgs.clear()
        batch_idx.clear()

    for i, path in enumerate(paths):
        if path is None:
            continue
        try:
            img = Image.open(path).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN: image decode failed for {path}: {exc}", file=sys.stderr)
            continue
        batch_imgs.append(preprocess(img))
        batch_idx.append(i)
        if len(batch_imgs) >= 32:
            flush()
    flush()
    return embs


def encode_text(df: pd.DataFrame) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(TEXT_MODEL)
    texts = [f"{row.title}. {row.description}" for row in df.itertuples()]
    return model.encode(
        texts, batch_size=32, show_progress_bar=True, normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mmfr-repo", type=Path,
        default=Path.home() / "ml-projects" / "multimodal-fashion-recommender",
        help="path to the multimodal-fashion-recommender checkout",
    )
    parser.add_argument("--brand", default=BRAND, choices=["snitch", "powerlook", "fashor"])
    parser.add_argument(
        "--out", type=Path,
        default=Path(__file__).resolve().parent.parent / "content" / "data" / "mmfr-projection.json",
    )
    parser.add_argument(
        "--image-cache", type=Path,
        default=Path(__file__).resolve().parent.parent / ".cache" / "mmfr-images",
    )
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")

    df = load_catalogue(args.mmfr_repo, args.brand)
    print(f"{len(df)} items in {args.brand}'s catalogue")

    categories = sorted(df["category"].unique())
    print(f"{len(categories)} real categories: {categories}")

    image_paths = download_images(df, args.image_cache)
    print("encoding images (open_clip ViT-B-32, openai pretrained)")
    image_emb = encode_images(image_paths, device)
    print("encoding text (sentence-transformers/all-MiniLM-L6-v2)")
    text_emb = encode_text(df)

    ckpt_path = args.mmfr_repo / "checkpoints" / "best.pt"
    print(f"loading real trained weights from {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    item_tower = ItemTower()
    item_state = {
        k.removeprefix("item_tower."): v
        for k, v in ckpt["model_state_dict"].items()
        if k.startswith("item_tower.")
    }
    item_tower.load_state_dict(item_state)
    item_tower.to(device).eval()
    print(f"checkpoint epoch {ckpt['epoch']}, its own val_recall_at_10={ckpt['metrics'].get('val_recall_at_10')}")

    with torch.no_grad():
        fused = item_tower(
            torch.from_numpy(image_emb).to(device),
            torch.from_numpy(text_emb).to(device),
        ).cpu().numpy()
    print(f"fused item vectors: {fused.shape}")

    # Real neighbor ranking, in the model's own 256 dimensions, before any
    # projection -- inner product on L2-normalized vectors is cosine.
    sim = fused @ fused.T
    np.fill_diagonal(sim, -np.inf)

    rng = np.random.default_rng(SEED)
    # One anchor per category where possible, so the six picks span the
    # catalogue's real structure rather than clustering in one section.
    anchor_categories = rng.choice(categories, size=min(N_ANCHORS, len(categories)), replace=False)
    anchors = []
    for cat in anchor_categories:
        idxs = df.index[df["category"] == cat].tolist()
        anchors.append(int(rng.choice(idxs)))

    print("projecting to 3D (t-SNE, seed 42)")
    coords = TSNE(
        n_components=3, perplexity=30, random_state=SEED, init="pca", max_iter=1000
    ).fit_transform(fused)
    coords = coords - coords.mean(axis=0)
    scale = float(np.percentile(np.abs(coords), 98))
    coords = np.clip(coords / scale, -1.0, 1.0)

    cat_to_cluster = {c: i for i, c in enumerate(categories)}

    points: list[dict[str, Any]] = []
    for i, row in enumerate(df.itertuples()):
        points.append({
            "id": str(row.product_id),
            "p": [round(float(c), 4) for c in coords[i]],
            "c": cat_to_cluster[row.category],
        })

    anchors_out: list[dict[str, Any]] = []
    for a in anchors:
        row = df.iloc[a]
        order = np.argsort(-sim[a])[:TOP_K]
        neighbors = []
        for rank, idx in enumerate(order, start=1):
            nrow = df.iloc[int(idx)]
            neighbors.append({
                "id": str(nrow["product_id"]),
                "title": str(nrow["title"])[:120],
                "category": str(nrow["category"]),
                "score": round(float(sim[a][idx]), 4),
                "rank": rank,
                "same_category": bool(nrow["category"] == row["category"]),
            })
        anchors_out.append({
            "id": str(row["product_id"]),
            "title": str(row["title"])[:120],
            "category": str(row["category"]),
            "neighbors": neighbors,
        })
        print(f"  anchor {row['product_id']} ({row['category']}): "
              f"{sum(1 for n in neighbors if n['same_category'])}/{TOP_K} neighbors share its category")

    payload = {
        "version": 1,
        "brand": args.brand,
        "image_model": f"open_clip {IMAGE_MODEL} ({IMAGE_PRETRAINED})",
        "text_model": TEXT_MODEL,
        "fusion": "checkpoints/best.pt item_tower.* -- concat(512+384) -> MLP(512) -> 256, L2-normalized",
        "similarity": "inner product on L2-normalised 256-dim embeddings, i.e. cosine",
        "projection": (
            "t-SNE (sklearn), n_components=3, perplexity=30, init=pca, random_state=42 -- "
            "layout only; every neighbor rank in this file was computed before projection"
        ),
        "categories": categories,
        "checkpoint_epoch": ckpt["epoch"],
        "checkpoint_val_recall_at_10": ckpt["metrics"].get("val_recall_at_10"),
        "source": (
            f"multimodal-fashion-recommender/data/{args.brand}/catalog.csv "
            f"({len(df)} real catalogue items, real Shopify CDN images) run through the real "
            "trained checkpoints/best.pt item tower -- not the H&M set the model was trained on, "
            "which is the exact day-one/no-purchase-history scenario this case study's own "
            "new-brand caveat names."
        ),
        "generated_at": date.today().isoformat(),
        "n_points": len(points),
        "points": points,
        "anchors": anchors_out,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = args.out.stat().st_size / 1024
    print(f"wrote {args.out} ({size_kb:.1f} KB, {len(points)} points, {len(anchors_out)} anchors)")


if __name__ == "__main__":
    main()
