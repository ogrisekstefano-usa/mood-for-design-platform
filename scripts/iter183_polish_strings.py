#!/usr/bin/env python3
"""
ITER183 · P0.1 Copy Quality Polish

Targeted, professional-grade fixes for awkward strings produced by the
mass-replacement script. Preserves i18n KEYS (technical identifiers) and
rewrites only VALUES (user-facing text).

Scope: en-US.json (master) + it-IT.json + cascade-light on other locales.
Run: python3 /app/scripts/iter183_polish_strings.py
"""
import json
from pathlib import Path

I18N_DIR = Path("/app/frontend/src/i18n/strings")

# ---------- EN-US ----------
EN_REPLACEMENTS = {
    # Relationship → Lead/Account/CRM
    "Close this drawer and open the Usage tab in the Inspector to navigate each relationship manually.":
        "Close this drawer and open the Usage tab in the Inspector to review each link manually.",
    "Relationship OS": "CRM Workspace",
    "Loading relationship…": "Loading record…",
    "Create relationship": "Create Lead",
    "Relationship created.": "Lead created.",
    "Unable to create the relationship.": "Unable to create the Lead.",
    "Le relazioni che attendono un gesto": "Leads to follow up",
    "No relationship has gone cold.": "No Lead has gone cold.",
    "Relationship Engine™": "CRM Engine™",
    "Nuova Relazione": "New Lead",
    # Inspirations / atmosphere
    "Sto leggendo le relazioni…": "Loading…",
    "Atmosfera in lettura editoriale": "Style analysis in progress",
    # Advisor copy
    "Relationship Economics": "Compensation Model",
    "Specialization & Understanding the Relationship": "Specialization & Approach",
    "Context, history, the sensibility of the relationship…":
        "Context, history, professional approach…",
    # CRM / Accounts
    "No Journey open for this relationship.": "No Design Journey open for this Account.",
    "The people in the relationship": "Contacts in this Account",
    "Segnali del viaggio": "Recent activity",
    "The memory of the relationship is still blank.": "No activity logged for this Account yet.",
    "An Account is a relationship — a client, a studio, a family. Contacts are the people inside that relationship.":
        "An Account groups your business with a client, studio, or family. Contacts are the people inside that Account.",
    "Relationship Graph™ · mappa editoriale": "CRM Network · Account map",
    "Dove vive la relazione": "Account location",
    # Journey / Chapter
    "Capitolo in corso": "Current phase",
    "Chapter Title (e.g., Mediterranean Light)": "Phase title (e.g. First concept review)",
    "Cosa cambia in questo capitolo — in poche righe":
        "What changes in this phase — in a few lines",
    # Studio archive
    "Studio studio archive": "Studio archive",
    # Inspirations broken placeholder
    "e.g. Material style": "e.g. Hospitality · Warm woods",
    "Es. Hospitality emotion · Material style": "e.g. Hospitality · Warm woods",
}

# ---------- IT-IT ----------
IT_REPLACEMENTS = {
    "Carica un nuovo file. Tutte le relazioni vengono migrate automaticamente al nuovo asset. La versione vecchia resta nel versioning ma non è più referenziata.":
        "Carica un nuovo file. Tutti i collegamenti vengono migrati automaticamente al nuovo asset. La versione precedente resta nel versioning ma non è più referenziata.",
    "L'asset viene archiviato (non più visibile nella Library) ma le relazioni restano attive. Il pubblico continua a vedere il contenuto.":
        "L'asset viene archiviato (non più visibile nella Library) ma i collegamenti restano attivi. Il pubblico continua a vedere il contenuto.",
    "Chiudi questo drawer e apri la tab Usage dell'Inspector per navigare manualmente ogni relazione.":
        "Chiudi questo drawer e apri la tab Usage dell'Inspector per gestire manualmente ogni collegamento.",
    "Relationship OS": "CRM",
    # relationships table block
    "Relazioni": "CRM",
    "Tutte le relazioni": "Tutti i record",
    "Nessuna relazione in questo filtro.": "Nessun record in questo filtro.",
    "Sto caricando la relazione…": "Caricamento in corso…",
    "Crea relazione": "Crea Lead",
    "Relazione creata.": "Lead creato.",
    "Impossibile creare la relazione.": "Impossibile creare il Lead.",
    # Companion / journey chapters
    "Capitolo attivo": "Fase attiva",
    "L'evoluzione del viaggio": "L'evoluzione del Design Journey",
    "Capitolo": "Fase",
    # Dashboard
    "Lo studio è in attesa del primo viaggio.": "Nessun Design Journey attivo.",
    "Le relazioni che attendono un gesto": "Lead da contattare",
    "Nessuna relazione raffreddata.": "Nessun Lead inattivo.",
    "Relationship Engine™": "CRM Engine™",
    # Projects
    "Continua il viaggio": "Continua il Design Journey",
    # Inspirations
    "Capitolo editoriale ·": "Sezione ·",
    "Sto leggendo le relazioni…": "Caricamento in corso…",
    # Advisor
    "Economia della relazione": "Modello di compenso",
    "Specializzazione & lettura della relazione": "Specializzazione & approccio",
    "Contesto, storia, sensibilità della relazione…":
        "Contesto, storia, approccio professionale…",
    # CRM Account
    "Nessun Journey aperto con questa relazione.": "Nessun Design Journey aperto per questo Account.",
    "Le persone della relazione": "Contatti dell'Account",
    "Segnali del viaggio": "Attività recenti",
    "La memoria della relazione è ancora bianca.": "Nessuna attività registrata per questo Account.",
    "Le relazioni della tua casa di design": "Il CRM del tuo studio",
    "Sala delle relazioni": "CRM",
    "Nessun Account ancora. Inizia a costruire la memoria delle tue relazioni.":
        "Nessun Account registrato. Inizia a costruire il tuo CRM.",
    "Un Account è una relazione — un cliente, uno studio, una famiglia. I Contact sono le persone dentro quella relazione.":
        "Un Account raggruppa il tuo business con un cliente, uno studio o una famiglia. I Contact sono le persone dentro quell'Account.",
    "Tracciando la mappa della relazione…": "Caricamento mappa Account…",
    "Relationship Graph™ · mappa editoriale": "CRM Network · Mappa Account",
    "Dove vive la relazione": "Sede dell'Account",
    # Journey
    "Capitolo in corso": "Fase in corso",
    "Capitolo precedente": "Fase precedente",
    "Capitolo seguente": "Fase successiva",
    "Capitolo primo · Brief Cliente": "Step 1 · Brief Cliente",
    "Forse il viaggio è stato già archiviato — o il link è stato modificato.\n            Scrivi allo studio per ritrovarlo.":
        "Forse il Design Journey è stato già archiviato — o il link è stato modificato.\n            Scrivi allo studio per ritrovarlo.",
    # workspace add reference
    "Es. Hospitality emotion · Material atmosphere": "Es. Hospitality · Legni caldi",
    # Atelier voice
    "Compagni di viaggio": "Team del progetto",
    # Atelier dashboard empty
    "Nessuna attività registrata. Le attività appariranno qui quando inizierai a gestire relazioni e progetti.":
        "Nessuna attività registrata. Le attività compariranno qui quando inizierai a gestire Lead e Design Journey.",
    # Broken value from auto-replace
    "Una frase che cattura l'stile, non un brief tecnico.":
        "Una frase che cattura lo stile, non un brief tecnico.",
    "Curando l'stile…": "Componendo lo stile…",
    "Componi l'stile.": "Componi lo stile.",
    "le materialità prevalenti, l'stile.":
        "le materialità prevalenti, lo stile.",
    "URL di un'immagine che racconta l'stile":
        "URL di un'immagine che racconta lo stile",
    "Racconta a parole tue — un'stile, un riferimento, una sensazione":
        "Racconta a parole tue — uno stile, un riferimento, una sensazione",
    "Condividi una stile": "Condividi uno stile",
    # Atmosfera leftover
    "Archivio selezionata dello studio": "Archivio dello studio",
    "Ancora nessuna affinità selezionata rilevata.": "Nessuna affinità di brand rilevata.",
}

# ---------- Cascade-light: apply EN-US fixes to en-GB if matched ----------
CASCADE_LOCALES = ["en-GB", "es-ES", "de-DE", "fr-FR", "ar"]


def replace_values_in_obj(obj, mapping):
    """Walk a JSON tree and replace string values via exact match."""
    count = 0
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                if v in mapping:
                    obj[k] = mapping[v]
                    count += 1
            else:
                count += replace_values_in_obj(v, mapping)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                if v in mapping:
                    obj[i] = mapping[v]
                    count += 1
            else:
                count += replace_values_in_obj(v, mapping)
    return count


def process(locale, mapping):
    path = I18N_DIR / f"{locale}.json"
    data = json.loads(path.read_text())
    n = replace_values_in_obj(data, mapping)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  {locale}: {n} replacements")


def main():
    print("ITER183 · P0.1 Copy polish")
    print(f"\nMaster (en-US):")
    process("en-US", EN_REPLACEMENTS)
    print(f"\nMaster (it-IT):")
    process("it-IT", IT_REPLACEMENTS)
    print(f"\nCascade-light (apply EN map where matched):")
    for loc in CASCADE_LOCALES:
        process(loc, EN_REPLACEMENTS)
    print("\nDone.")


if __name__ == "__main__":
    main()
