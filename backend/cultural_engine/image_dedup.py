"""Image Dedup — Phase 1 Knowledge Factory.

Perceptual hashing for detecting duplicate or near-duplicate images
inside a product section (or across a single document).

Strategy:
  • compute pHash (perceptual hash, 64-bit) on a downscaled grayscale
    image via the `imagehash` library
  • group images with Hamming distance ≤ HAMMING_THRESHOLD into the same
    similarity_group (deterministic key = sorted shortest hash in group)

Conservative defaults to avoid false positives: HAMMING_THRESHOLD=8 / 64.

Public API:
    compute_phash(image_bytes: bytes) -> str | None
    group_by_similarity(items: List[{key, phash}]) -> Dict[key, group_key]
"""
from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

HAMMING_THRESHOLD = 8  # distance ≤ threshold ⇒ same group (out of 64 bits)


def compute_phash(image_bytes: bytes) -> Optional[str]:
    """Return the hex pHash of the image, or None on failure."""
    if not image_bytes:
        return None
    try:
        import imagehash
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        h = imagehash.phash(img, hash_size=8)  # 64-bit
        return str(h)
    except Exception as e:
        logger.warning(f"phash compute failed: {e}")
        return None


def _hex_to_imagehash(hex_str: str):
    import imagehash
    return imagehash.hex_to_hash(hex_str)


def group_by_similarity(
    items: List[Dict[str, Any]],
    threshold: int = HAMMING_THRESHOLD,
) -> Dict[str, str]:
    """Cluster items by pHash similarity.

    Args:
        items: list of dicts with at least {"key": str, "phash": Optional[str]}
        threshold: max Hamming distance for items to share a group

    Returns:
        {item_key: group_key} — group_key is the deterministic id of the
        cluster (the smallest pHash in the cluster, or the item key itself
        for items without a phash).
    """
    try:
        import imagehash  # noqa: F401
    except ImportError:
        logger.warning("imagehash not installed — dedup disabled.")
        return {it["key"]: it["key"] for it in items}

    # Items with a phash
    hashed: List[Dict[str, Any]] = []
    for it in items:
        if it.get("phash"):
            try:
                it_local = dict(it)
                it_local["_h"] = _hex_to_imagehash(it["phash"])
                hashed.append(it_local)
            except Exception:
                pass

    # Greedy clustering — O(n²) but acceptable on ≤ 500 assets
    clusters: List[List[Dict[str, Any]]] = []
    for it in hashed:
        placed = False
        for cluster in clusters:
            # Compare to cluster representative (first element)
            rep = cluster[0]
            try:
                d = it["_h"] - rep["_h"]
            except TypeError:
                continue
            if d <= threshold:
                cluster.append(it)
                placed = True
                break
        if not placed:
            clusters.append([it])

    mapping: Dict[str, str] = {}
    for cluster in clusters:
        # Group key = sorted shortest phash in cluster
        rep_phash = min(c["phash"] for c in cluster)
        group_key = f"sim_{rep_phash[:12]}"
        for c in cluster:
            mapping[c["key"]] = group_key

    # Items without a phash → singleton groups
    for it in items:
        if it["key"] not in mapping:
            mapping[it["key"]] = it["key"]

    return mapping
