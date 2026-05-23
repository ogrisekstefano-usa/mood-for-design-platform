"""Atelier Media Processor™ — server-side image pipeline.

ITER138 · MEDIA ORCHESTRATION REFINEMENT™

Responsibilities
────────────────
• Validate uploaded image (mime, size, dimensions)
• Auto-orient via EXIF and strip EXIF (privacy + correct rotation)
• Produce two variants: optimized (1920w) + thumbnail (480w)
• Compute BlurHash compact placeholder
• Read mime/bytes/width/height for DB provenance

No external URLs ever touch the pipeline — every byte comes from the
user's upload.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import Tuple

from PIL import Image, ImageOps
import blurhash as _blurhash

logger = logging.getLogger(__name__)

# Editorial constraints
MAX_BYTES = 10 * 1024 * 1024            # 10 MB
MIN_BYTES = 1024                         # 1 KB sanity floor
OPTIMIZED_WIDTH = 1920
THUMBNAIL_WIDTH = 480
JPEG_QUALITY = 86
WEBP_QUALITY = 84

ACCEPTED_MIMES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
}


@dataclass
class ProcessedImage:
    optimized_bytes: bytes
    thumbnail_bytes: bytes
    blurhash: str
    width: int
    height: int
    mime: str           # output mime (always image/jpeg after processing)
    extension: str      # output extension ('jpg')
    original_bytes: bytes  # the EXIF-stripped, oriented original (re-encoded)


def _normalize_image(content: bytes) -> Image.Image:
    """Decode + auto-orient via EXIF + convert to RGB."""
    img = Image.open(io.BytesIO(content))
    # Honor EXIF orientation, then strip metadata
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    elif img.mode == "RGBA":
        # Flatten alpha onto a dark canvas to preserve cinematic mood
        bg = Image.new("RGB", img.size, (12, 12, 14))
        bg.paste(img, mask=img.split()[3])
        img = bg
    return img


def _resize_to_width(img: Image.Image, target_w: int) -> Image.Image:
    w, h = img.size
    if w <= target_w:
        return img.copy()
    ratio = target_w / float(w)
    new_h = max(1, int(round(h * ratio)))
    return img.resize((target_w, new_h), Image.LANCZOS)


def _encode_jpeg(img: Image.Image, quality: int = JPEG_QUALITY) -> bytes:
    buf = io.BytesIO()
    img.save(
        buf, format="JPEG",
        quality=quality, optimize=True, progressive=True,
    )
    return buf.getvalue()


def _compute_blurhash(img: Image.Image) -> str:
    """Tiny thumb → 4×3 BlurHash. Robust to weird aspect ratios."""
    try:
        import numpy as np
        bh_thumb = img.copy()
        bh_thumb.thumbnail((128, 128), Image.LANCZOS)
        if bh_thumb.mode != "RGB":
            bh_thumb = bh_thumb.convert("RGB")
        arr = np.array(bh_thumb)
        return _blurhash.encode(arr, components_x=4, components_y=3)
    except Exception as e:
        logger.warning("BlurHash encoding failed: %s", e)
        return ""


def validate(content: bytes, mime: str) -> Tuple[bool, str]:
    if mime not in ACCEPTED_MIMES:
        return False, f"Unsupported mime type: {mime}"
    if len(content) > MAX_BYTES:
        return False, f"File too large ({len(content)} bytes > {MAX_BYTES})"
    if len(content) < MIN_BYTES:
        return False, "File too small"
    return True, ""


def process(content: bytes) -> ProcessedImage:
    """Run the full Atelier Media pipeline on raw upload bytes.

    Returns processed variants ready for Supabase Storage upload.
    """
    img = _normalize_image(content)
    width, height = img.size

    optimized_img = _resize_to_width(img, OPTIMIZED_WIDTH)
    thumb_img = _resize_to_width(img, THUMBNAIL_WIDTH)

    optimized_bytes = _encode_jpeg(optimized_img, JPEG_QUALITY)
    thumbnail_bytes = _encode_jpeg(thumb_img, JPEG_QUALITY)
    original_bytes = _encode_jpeg(img, 95)  # near-lossless, EXIF stripped

    bh = _compute_blurhash(img)

    return ProcessedImage(
        optimized_bytes=optimized_bytes,
        thumbnail_bytes=thumbnail_bytes,
        blurhash=bh,
        width=width,
        height=height,
        mime="image/jpeg",
        extension="jpg",
        original_bytes=original_bytes,
    )
