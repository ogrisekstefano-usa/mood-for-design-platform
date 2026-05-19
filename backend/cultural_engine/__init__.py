"""MOOD Cultural Intelligence Engine™ — 3-layer hybrid system.

Layer 1 (vision_provider_adapter) extracts SIGNALS from images.
Layer 2 (descriptor_mapper) maps signals → cultural descriptors → market scores.
Layer 3 (editorial_interpreter) renders the result as editorial narrative.

Each layer is independently testable and the provider for Layer 1 is
swappable via env vars CULTURAL_VISION_PROVIDER + CULTURAL_VISION_MODEL.
"""
from . import vision_provider_adapter, descriptor_mapper, editorial_interpreter  # noqa: F401
