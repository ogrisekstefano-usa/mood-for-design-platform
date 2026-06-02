"""ARBI Designer Registry — verified designers for the ARBI brand.

The registry overrides OCR extraction. Only names in this list will be
accepted as designers. Anyone else is downgraded to needs_review.
"""
ARBI_REGISTRY = [
    "Marco Acerbis",
    "Enrico Cesana",
    "Massimo Iosa Ghini",
    "Studio Quattroterzi",
    "Carlo Colombo",
    "Lievore Altherr",
    "Stefano Cavazzana",
    "Luca Papini",
]

REGISTRIES = {
    # brand_id → list of canonical designer names
    "ab1399d7-ab6a-498e-8c4f-bc36af69e182": ARBI_REGISTRY,   # ARBI
}
