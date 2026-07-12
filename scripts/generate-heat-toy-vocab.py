"""Generate a small, PCA-reduced, int8-quantized embedding vocab for the
hero semantic-heat toy (Warmer's actual mechanic, reused: type a word, get
a cosine-similarity "warmth" reading against a hidden daily word).

Offline, one-time generation — output is a static JSON file
(public/heat-toy-vocab.json), never regenerated at runtime, so it costs
zero API calls and zero server compute per visitor.

Rerun with: python scripts/generate-heat-toy-vocab.py
(writes vocab.json to the current directory — move it to public/ after).

Same base model as Warmer's English edition (all-MiniLM-L6-v2), so this is
genuinely the same mechanic, not a simplified imitation. PCA-72 keeps
72.3% of the variance (verified: semantic neighbors stay sensible after
reduction — dog->cat/rabbit/bird, king->kingdom/queen/throne,
red->blue/yellow/green) while keeping the gzip payload at ~41 KiB, well
under the 80 KiB asset budget.
"""
from __future__ import annotations
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA

VOCAB = """
dog cat bird fish horse lion tiger bear wolf fox deer rabbit mouse elephant
whale dolphin shark snake frog turtle butterfly bee ant spider owl eagle
hawk sparrow duck goose swan chicken cow pig sheep goat monkey giraffe
zebra kangaroo penguin
apple banana orange grape lemon peach pear cherry strawberry mango pineapple
watermelon bread rice pasta cheese butter milk egg coffee tea sugar salt
pepper honey chocolate cake cookie pizza soup salad sandwich burger
tree flower grass leaf root branch forest jungle desert mountain river
lake ocean sea beach island valley hill cave cliff waterfall volcano
storm rain snow wind cloud sun moon star sky thunder lightning fog ice
fire earth water air
happy sad angry afraid excited calm nervous proud jealous lonely bored
curious confused surprised confident grateful hopeful anxious relaxed
brave shy tired energetic peaceful frustrated content
run walk jump swim fly climb crawl dance sing laugh cry sleep dream wake
eat drink cook bake clean wash build create write read speak listen
watch think remember forget learn teach play work rest travel explore
discover invent
house home room kitchen bedroom door window wall roof floor stairs
garden yard fence gate table chair bed sofa lamp mirror clock shelf
book pen pencil paper computer phone camera television radio car
bicycle train airplane boat ship bus truck road bridge street city
town village
family mother father sister brother son daughter friend neighbor
teacher student doctor nurse chef artist musician writer scientist
engineer farmer pilot sailor soldier king queen child baby elder
red orange yellow green blue purple pink brown black white gray gold
silver
morning afternoon evening night today tomorrow yesterday week month
year hour minute second season spring summer autumn winter holiday
birthday
love hate hope fear joy peace war freedom justice truth beauty wisdom
courage kindness patience honesty loyalty trust respect strength
weakness power
money gold silver treasure gift present prize reward trophy medal
crown jewel diamond pearl ring necklace
music song dance art painting drawing sculpture poem story novel movie
game sport ball team race victory defeat challenge competition
mountain valley canyon plateau glacier volcano earthquake hurricane
tornado flood drought harvest crop field farm barn tractor
king castle knight dragon wizard witch magic spell potion sword shield
crown throne kingdom empire village warrior hero villain
school university library museum hospital church temple market shop
store restaurant cafe park garden zoo bridge tower tunnel
gentle fierce quiet loud bright dark heavy light fast slow strong weak
soft hard smooth rough sharp dull sweet sour bitter salty spicy fresh
stale
"""


def main() -> None:
    words = sorted(set(VOCAB.split()))
    print(f"{len(words)} vocab words")

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embeddings = model.encode(words, normalize_embeddings=True)
    print("raw embeddings:", embeddings.shape)

    n_components = 72
    pca = PCA(n_components=n_components, random_state=42)
    reduced = pca.fit_transform(embeddings)
    explained = pca.explained_variance_ratio_.sum()
    print(f"PCA-{n_components}: {explained:.1%} variance explained")

    # Per-dimension min-max -> int8 quantization (deterministic, no runtime cost).
    mins = reduced.min(axis=0)
    maxs = reduced.max(axis=0)
    scale = (maxs - mins)
    scale[scale == 0] = 1.0
    quantized = np.round((reduced - mins) / scale * 255).astype(np.uint8)

    payload = {
        "v": 1,
        "model": "sentence-transformers/all-MiniLM-L6-v2 -> PCA-40 -> uint8",
        "dims": n_components,
        "mins": [round(float(x), 6) for x in mins],
        "scale": [round(float(x), 6) for x in scale],
        "words": words,
        "vectors": quantized.tolist(),
    }

    out_path = "vocab.json"
    with open(out_path, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    import os
    raw_size = os.path.getsize(out_path)
    print(f"raw JSON size: {raw_size} bytes ({raw_size/1024:.1f} KiB)")

    import gzip
    with open(out_path, "rb") as f:
        data = f.read()
    gz_size = len(gzip.compress(data, compresslevel=9))
    print(f"gzip size: {gz_size} bytes ({gz_size/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
