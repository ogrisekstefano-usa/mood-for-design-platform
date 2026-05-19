"""
seed_market_intelligence.py — Market Matrix™ Humanized Intelligence
═══════════════════════════════════════════════════════════════════════
Seeds `markets.market_intelligence` with designer-facing data:

  • 5 short editorial keywords per locale (for chips)
  • 7 insight fields per locale (tone, visual style, CTA behavior,
    client expectations, imagery, headlines, cultural pitfalls)

Locales: it-IT · en-US · en-GB · es-ES · fr-FR · de-DE

NEVER tags like "serif-led" or "magazine-led". Always natural,
designer-friendly words in the target language.

Idempotent — safe to re-run.
"""
from __future__ import annotations
import os
import sys
import psycopg2
import psycopg2.extras
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# ───────────────────────────────────────────────────────────────────────
# DATA — humanized per market × per locale.
# Each (market_code → locale → keywords/insights) is hand-written, NOT
# auto-translated. We pick the natural designer vocabulary in each
# language (e.g. "warm" → "caldo" in IT, "chaleureux" in FR).
# ───────────────────────────────────────────────────────────────────────

MARKET_INTELLIGENCE = {
    # ═══════════════════════════════════ EUROPE ═══════════════════════
    "italy": {
        "it-IT": {
            "keywords": ["narrativo", "emotivo", "sartoriale", "caldo", "relazionale"],
            "insights": {
                "tone": "Conversazione lenta, tono colto ma personale. Si parla di materia, di mestiere, di luce. Mai promozionale.",
                "visual_style": "Fotografia ambientata, luce calda naturale, dettagli artigianali in primo piano, vita reale dentro lo spazio.",
                "cta_behavior": "Consulenza privata o visita allo showroom. CTA pacate, scritte in prima persona, mai aggressive.",
                "client_expectations": "Riconoscimento del proprio gusto, attenzione personale, tempo. La fiducia si costruisce nella relazione, non nel pitch.",
                "imagery": "Interni vissuti, materiali tattili (legno · pietra · tessuti naturali), still life di artigianato, ritratti dello studio.",
                "headlines": "Frasi brevi, evocative, in italiano impeccabile. Un sostantivo forte e un aggettivo preciso. Niente claim aziendali.",
                "pitfalls": "Tono americano da 'unlock your dream'. Inglese non necessario. Stock photo. Bullet point freddi. CTA con countdown.",
            },
        },
        "en-US": {
            "keywords": ["narrative", "warm", "tailored", "intimate", "craft-led"],
            "insights": {
                "tone": "Cultured and personal. Talk about material, craft, and light — never sales.",
                "visual_style": "Lived-in interiors, warm natural light, artisan close-ups, real life inside the space.",
                "cta_behavior": "Private consultation or showroom visit. Soft first-person CTAs, never pressured.",
                "client_expectations": "Recognition of taste, personal attention, time. Trust is built in relationship, not pitch.",
                "imagery": "Real interiors, tactile materials (wood · stone · linen), artisan still-life, studio portraits.",
                "headlines": "Short, evocative, impeccably written. One strong noun + one precise adjective.",
                "pitfalls": "American 'unlock your dream' tone. Unnecessary English in IT copy. Stock photos. Countdown CTAs.",
            },
        },
        "en-GB": {
            "keywords": ["narrative", "considered", "tailored", "warm", "craft-led"],
            "insights": {
                "tone": "Considered and personal. Material, craft, light — never overt sales.",
                "visual_style": "Lived-in interiors, warm natural light, artisan close-ups, real life inside the room.",
                "cta_behavior": "Private consultation or atelier visit. First-person, gentle.",
                "client_expectations": "Recognition of taste, personal attention, time. Trust over pitch.",
                "imagery": "Real interiors, tactile materials, artisan still-life, atelier portraits.",
                "headlines": "Short, evocative, beautifully written. A strong noun and a precise adjective.",
                "pitfalls": "Hard-sell tone. Countdown CTAs. Generic stock photography.",
            },
        },
        "fr-FR": {
            "keywords": ["narratif", "chaleureux", "sur-mesure", "intime", "artisanal"],
            "insights": {
                "tone": "Conversation lente, ton cultivé et personnel. On parle de matière, de geste, de lumière. Jamais promotionnel.",
                "visual_style": "Photographie habitée, lumière naturelle chaude, gros plans d'artisanat, vie réelle dans l'espace.",
                "cta_behavior": "Consultation privée ou visite du showroom. CTA en première personne, jamais pressants.",
                "client_expectations": "Reconnaissance du goût, attention personnelle, temps. La confiance se construit dans la relation.",
                "imagery": "Intérieurs vécus, matières tactiles (bois · pierre · tissus), nature morte d'atelier, portraits du studio.",
                "headlines": "Phrases courtes, évocatrices, écriture impeccable. Un nom fort, un adjectif précis.",
                "pitfalls": "Ton commercial américain. Anglais inutile. Photos stock. CTA avec compte à rebours.",
            },
        },
        "es-ES": {
            "keywords": ["narrativo", "cálido", "sastre", "íntimo", "artesanal"],
            "insights": {
                "tone": "Conversación pausada, tono culto y personal. Se habla de materia, oficio, luz. Nunca promocional.",
                "visual_style": "Fotografía habitada, luz natural cálida, detalles artesanales en primer plano, vida real dentro del espacio.",
                "cta_behavior": "Consulta privada o visita al showroom. CTAs en primera persona, sin presión.",
                "client_expectations": "Reconocimiento del gusto, atención personal, tiempo. La confianza se construye en la relación.",
                "imagery": "Interiores vividos, materiales táctiles (madera · piedra · lino), bodegones de artesanía, retratos de estudio.",
                "headlines": "Frases breves, evocadoras, escritura impecable. Un sustantivo fuerte y un adjetivo preciso.",
                "pitfalls": "Tono comercial americano. Inglés innecesario. Fotos de stock. CTAs con cuenta atrás.",
            },
        },
        "de-DE": {
            "keywords": ["erzählerisch", "warm", "maßgefertigt", "vertraulich", "handwerklich"],
            "insights": {
                "tone": "Bedacht und persönlich. Material, Handwerk, Licht — niemals offen verkäuferisch.",
                "visual_style": "Gelebte Innenräume, warmes Naturlicht, Handwerks-Nahaufnahmen, reales Leben im Raum.",
                "cta_behavior": "Privatberatung oder Showroom-Besuch. Erste Person, ruhig, nie drängend.",
                "client_expectations": "Anerkennung des Geschmacks, persönliche Aufmerksamkeit, Zeit. Vertrauen statt Pitch.",
                "imagery": "Echte Interiors, taktile Materialien, Atelier-Stillleben, Studio-Porträts.",
                "headlines": "Kurze, eindringliche Sätze, makellos geschrieben. Ein starkes Substantiv, ein präzises Adjektiv.",
                "pitfalls": "Harter Verkaufston. Countdown-CTAs. Generische Stockfotos.",
            },
        },
    },

    "dach": {
        "it-IT": {
            "keywords": ["preciso", "minimale", "razionale", "tecnico", "ordinato"],
            "insights": {
                "tone": "Asciutto, ordinato, basato su fatti. Si misura, si descrive, si certifica. La fiducia nasce dalla chiarezza, non dall'emozione.",
                "visual_style": "Luce diurna, fotografia architettonica frontale, dettagli costruttivi, materiali certificati visibili.",
                "cta_behavior": "Richiesta di scheda tecnica, sopralluogo, preventivo dettagliato. Processo chiaro, tempi indicati.",
                "client_expectations": "Documentazione completa, riferimenti normativi, garanzie scritte, sostenibilità tracciabile.",
                "imagery": "Architettura nitida, viste di sezione, materiali esposti come campioni, palette neutre, ordine spaziale.",
                "headlines": "Sostantivi precisi, niente metafore. Si comunica un fatto: 'Finitura naturale a olio · Quercia europea PEFC'.",
                "pitfalls": "Tono troppo poetico o emotivo. Vaghezza sui dettagli tecnici. CTA sentimentali. Italianismo eccessivo.",
            },
        },
        "en-US": {
            "keywords": ["precise", "minimal", "rational", "technical", "considered"],
            "insights": {
                "tone": "Dry, orderly, fact-based. We measure, describe, certify. Trust comes from clarity, not emotion.",
                "visual_style": "Daylight, architectural photography, construction details, visible certified materials.",
                "cta_behavior": "Request tech sheet, site visit, detailed quote. Clear process, stated timelines.",
                "client_expectations": "Complete documentation, code references, written guarantees, traceable sustainability.",
                "imagery": "Crisp architecture, section views, exposed material samples, neutral palettes, spatial order.",
                "headlines": "Precise nouns, no metaphors. State a fact: 'Natural oil finish · PEFC European oak'.",
                "pitfalls": "Overly poetic or emotional tone. Vague specs. Sentimental CTAs.",
            },
        },
        "en-GB": {
            "keywords": ["precise", "restrained", "rational", "technical", "ordered"],
            "insights": {
                "tone": "Dry, restrained, fact-based. Measured language. Trust through clarity.",
                "visual_style": "Daylight, architectural photography, construction details, visible certified materials.",
                "cta_behavior": "Request tech sheet, site visit, detailed estimate. Clear process and timelines.",
                "client_expectations": "Complete documentation, code references, written guarantees, traceable provenance.",
                "imagery": "Crisp architecture, section views, exposed material samples, neutral palettes.",
                "headlines": "Precise nouns, no metaphors. State the fact.",
                "pitfalls": "Overly poetic tone. Vague specs. Sentimental copy.",
            },
        },
        "fr-FR": {
            "keywords": ["précis", "minimal", "rationnel", "technique", "ordonné"],
            "insights": {
                "tone": "Sec, ordonné, fondé sur les faits. On mesure, on décrit, on certifie. La confiance vient de la clarté.",
                "visual_style": "Lumière du jour, photographie architecturale frontale, détails de construction, matériaux certifiés visibles.",
                "cta_behavior": "Demande de fiche technique, visite de chantier, devis détaillé. Processus clair, délais annoncés.",
                "client_expectations": "Documentation complète, références normatives, garanties écrites, traçabilité durable.",
                "imagery": "Architecture nette, vues en coupe, échantillons de matériaux, palettes neutres, ordre spatial.",
                "headlines": "Noms précis, sans métaphores. On énonce un fait.",
                "pitfalls": "Ton trop poétique ou émotionnel. Flou technique. CTA sentimentaux.",
            },
        },
        "es-ES": {
            "keywords": ["preciso", "minimal", "racional", "técnico", "ordenado"],
            "insights": {
                "tone": "Seco, ordenado, basado en hechos. Se mide, se describe, se certifica. La confianza nace de la claridad.",
                "visual_style": "Luz diurna, fotografía arquitectónica frontal, detalles constructivos, materiales certificados visibles.",
                "cta_behavior": "Solicitud de ficha técnica, visita, presupuesto detallado. Proceso claro, plazos indicados.",
                "client_expectations": "Documentación completa, normativa, garantías escritas, sostenibilidad trazable.",
                "imagery": "Arquitectura nítida, vistas de sección, muestras de material, paletas neutras.",
                "headlines": "Sustantivos precisos, sin metáforas. Se enuncia un hecho.",
                "pitfalls": "Tono excesivamente poético. Vaguedad técnica. CTAs sentimentales.",
            },
        },
        "de-DE": {
            "keywords": ["präzise", "minimal", "rational", "technisch", "geordnet"],
            "insights": {
                "tone": "Sachlich, geordnet, faktenbasiert. Wir messen, beschreiben, zertifizieren. Vertrauen entsteht durch Klarheit.",
                "visual_style": "Tageslicht, architektonische Frontalfotografie, Konstruktionsdetails, sichtbare zertifizierte Materialien.",
                "cta_behavior": "Datenblatt anfordern, Vor-Ort-Termin, detailliertes Angebot. Klarer Prozess, genannte Termine.",
                "client_expectations": "Vollständige Dokumentation, Normverweise, schriftliche Garantien, nachvollziehbare Nachhaltigkeit.",
                "imagery": "Klare Architektur, Schnittansichten, Materialmuster, neutrale Paletten, räumliche Ordnung.",
                "headlines": "Präzise Substantive, keine Metaphern. Eine Tatsache: 'Natur-Öl-Finish · PEFC-Eiche'.",
                "pitfalls": "Zu poetischer oder emotionaler Ton. Unscharfe Spezifikationen. Sentimentale CTAs.",
            },
        },
    },

    "france_fr_europe": {
        "it-IT": {
            "keywords": ["raffinato", "savoir-faire", "discreto", "elegante", "atelier"],
            "insights": {
                "tone": "Eleganza misurata, scrittura colta, riferimenti culturali sottintesi. La cifra è la sottrazione, non l'effetto.",
                "visual_style": "Composizioni precise, luce parigina, materiali nobili (pietra calcarea · velluto · ottone), prospettiva architettonica.",
                "cta_behavior": "Prendre rendez-vous, scoprire l'atelier, ricevere il dossier. Tono accademico, mai venditoriale.",
                "client_expectations": "Cultura del progetto, riferimenti d'art de vivre, discrezione assoluta sui propri clienti.",
                "imagery": "Interni haussmanniani contemporanei, dettagli di marquetry/boiserie, ritratti d'atelier, materia nobile.",
                "headlines": "Eleganza francese: nominale, ritmata, mai roboante. Spesso una sola parola forte.",
                "pitfalls": "Approccio commerciale diretto. Eccesso di anglicismi. Stock photo. Caps lock.",
            },
        },
        "en-US": {
            "keywords": ["refined", "savoir-faire", "discreet", "elegant", "atelier"],
            "insights": {
                "tone": "Measured elegance, cultured writing, references implied. Subtraction over effect.",
                "visual_style": "Precise compositions, Parisian light, noble materials (limestone · velvet · brass), architectural perspective.",
                "cta_behavior": "Book a viewing, discover the atelier, request the dossier. Academic, never sales-y.",
                "client_expectations": "Project culture, art-de-vivre references, absolute discretion about clientele.",
                "imagery": "Contemporary Haussmann interiors, marquetry/boiserie details, atelier portraits, noble materials.",
                "headlines": "Nominal, rhythmic, never bombastic. Often a single strong word.",
                "pitfalls": "Direct commercial approach. Caps-lock. Stock photography.",
            },
        },
        "en-GB": {
            "keywords": ["refined", "savoir-faire", "discreet", "considered", "atelier"],
            "insights": {
                "tone": "Measured elegance, cultured writing, references implied. Subtraction over effect.",
                "visual_style": "Precise compositions, Parisian light, noble materials, architectural perspective.",
                "cta_behavior": "Book a viewing, discover the atelier, request a dossier.",
                "client_expectations": "Project culture, art-de-vivre, absolute discretion.",
                "imagery": "Contemporary Haussmann interiors, marquetry details, atelier portraits.",
                "headlines": "Nominal, rhythmic, never bombastic.",
                "pitfalls": "Direct commercial approach. Caps-lock. Stock photography.",
            },
        },
        "fr-FR": {
            "keywords": ["raffiné", "savoir-faire", "discret", "élégant", "atelier"],
            "insights": {
                "tone": "Élégance mesurée, écriture cultivée, références implicites. La signature est dans la soustraction.",
                "visual_style": "Compositions précises, lumière parisienne, matières nobles (pierre · velours · laiton), perspective architecturale.",
                "cta_behavior": "Prendre rendez-vous, découvrir l'atelier, recevoir le dossier. Ton académique, jamais commercial.",
                "client_expectations": "Culture du projet, références d'art de vivre, discrétion absolue sur la clientèle.",
                "imagery": "Intérieurs haussmanniens contemporains, marqueterie, portraits d'atelier, matière noble.",
                "headlines": "Élégance nominale, rythmée, jamais grandiloquente. Souvent un seul mot fort.",
                "pitfalls": "Approche commerciale directe. Anglicismes inutiles. Photos de stock. Majuscules excessives.",
            },
        },
        "es-ES": {
            "keywords": ["refinado", "savoir-faire", "discreto", "elegante", "atelier"],
            "insights": {
                "tone": "Elegancia medida, escritura culta, referencias implícitas. La firma es la sustracción.",
                "visual_style": "Composiciones precisas, luz parisina, materiales nobles (piedra · terciopelo · latón), perspectiva arquitectónica.",
                "cta_behavior": "Pedir cita, descubrir el atelier, recibir el dossier. Tono académico, nunca comercial.",
                "client_expectations": "Cultura de proyecto, art-de-vivre, discreción absoluta sobre la clientela.",
                "imagery": "Interiores haussmannianos contemporáneos, marquetería, retratos de atelier, materia noble.",
                "headlines": "Elegancia nominal, rítmica, nunca grandilocuente. A menudo una sola palabra fuerte.",
                "pitfalls": "Enfoque comercial directo. Anglicismos. Fotos de stock. Mayúsculas excesivas.",
            },
        },
        "de-DE": {
            "keywords": ["raffiniert", "savoir-faire", "diskret", "elegant", "atelier"],
            "insights": {
                "tone": "Gemessene Eleganz, kultivierte Schrift, implizite Verweise. Die Signatur liegt in der Reduktion.",
                "visual_style": "Präzise Kompositionen, Pariser Licht, edle Materialien (Kalkstein · Samt · Messing), architektonische Perspektive.",
                "cta_behavior": "Termin vereinbaren, Atelier entdecken, Dossier anfordern. Akademischer Ton, nie verkäuferisch.",
                "client_expectations": "Projektkultur, Art-de-vivre-Referenzen, absolute Diskretion.",
                "imagery": "Zeitgenössische Haussmann-Interieurs, Marketerie, Atelier-Porträts, edle Materie.",
                "headlines": "Nominal, rhythmisch, nie pathetisch. Oft ein einziges starkes Wort.",
                "pitfalls": "Direkter kommerzieller Ansatz. Unnötige Anglizismen. Stockfotos. Versalien-Exzess.",
            },
        },
    },

    "uk_ireland": {
        "it-IT": {
            "keywords": ["heritage", "asciutto", "ironico", "tradizione", "ben scritto"],
            "insights": {
                "tone": "Asciutto, colto, con ironia controllata. Pochi superlativi. La scrittura conta quanto il design.",
                "visual_style": "Interni heritage rivisitati, materiali patinati (cuoio · legno scuro · velluto), luce londinese soffusa.",
                "cta_behavior": "Discover, enquire, visit our atelier. Tono editoriale alla Wallpaper o House & Garden.",
                "client_expectations": "Editorial quality, riferimenti colti, attenzione alla scrittura, discrezione.",
                "imagery": "Townhouse, country house, club privati, dettagli di sartoria, ritratti b/n editoriali.",
                "headlines": "Frasi brevi, ben scritte, mai grandiose. L'understatement è la firma.",
                "pitfalls": "Tono americano enfatico. Eccesso di entusiasmo. Mancanza di sense of humour. Punteggiatura sciatta.",
            },
        },
        "en-US": {
            "keywords": ["heritage", "dry", "witty", "tradition", "well-written"],
            "insights": {
                "tone": "Dry, cultured, controlled wit. Few superlatives. Writing matters as much as design.",
                "visual_style": "Heritage interiors reimagined, patinated materials (leather · dark wood · velvet), soft London light.",
                "cta_behavior": "Discover, enquire, visit our atelier. Editorial — Wallpaper or House & Garden tone.",
                "client_expectations": "Editorial quality, cultured references, attention to writing, discretion.",
                "imagery": "Townhouses, country houses, private clubs, sartorial details, editorial b/w portraits.",
                "headlines": "Short, well-written, never grand. Understatement is the signature.",
                "pitfalls": "American emphatic tone. Excess enthusiasm. No sense of humour. Sloppy punctuation.",
            },
        },
        "en-GB": {
            "keywords": ["heritage", "dry", "witty", "tradition", "well-written"],
            "insights": {
                "tone": "Dry, cultured, controlled wit. Few superlatives. The writing matters as much as the design.",
                "visual_style": "Heritage interiors reimagined, patinated materials, soft London light.",
                "cta_behavior": "Discover, enquire, visit our atelier. Editorial — Wallpaper / House & Garden voice.",
                "client_expectations": "Editorial quality, cultured references, careful writing, discretion.",
                "imagery": "Townhouses, country houses, private clubs, sartorial details, editorial b/w portraits.",
                "headlines": "Short, well-written, never grand. Understatement is the signature.",
                "pitfalls": "Emphatic American tone. Excess enthusiasm. No sense of humour. Sloppy punctuation.",
            },
        },
        "fr-FR": {
            "keywords": ["heritage", "sobre", "spirituel", "tradition", "bien écrit"],
            "insights": {
                "tone": "Sobre, cultivé, esprit retenu. Peu de superlatifs. L'écriture compte autant que le design.",
                "visual_style": "Intérieurs heritage réinventés, matières patinées (cuir · bois sombre · velours), lumière londonienne douce.",
                "cta_behavior": "Découvrir, demander, visiter l'atelier. Ton éditorial — voix Wallpaper / House & Garden.",
                "client_expectations": "Qualité éditoriale, références cultivées, attention à l'écriture, discrétion.",
                "imagery": "Townhouses, country houses, clubs privés, détails de tailleur, portraits éditoriaux n/b.",
                "headlines": "Brèves, bien écrites, jamais grandiloquentes. L'understatement est la signature.",
                "pitfalls": "Ton emphatique américain. Excès d'enthousiasme. Manque d'esprit.",
            },
        },
        "es-ES": {
            "keywords": ["heritage", "sobrio", "ingenioso", "tradición", "bien escrito"],
            "insights": {
                "tone": "Sobrio, culto, ingenio contenido. Pocos superlativos. La escritura cuenta tanto como el diseño.",
                "visual_style": "Interiores heritage reinterpretados, materiales con pátina (cuero · madera oscura · terciopelo), luz londinense suave.",
                "cta_behavior": "Descubrir, consultar, visitar el atelier. Tono editorial — voz Wallpaper / House & Garden.",
                "client_expectations": "Calidad editorial, referencias cultas, atención a la escritura, discreción.",
                "imagery": "Townhouses, casas de campo, clubs privados, detalles sartoriales, retratos editoriales b/n.",
                "headlines": "Breves, bien escritas, nunca grandilocuentes. El understatement es la firma.",
                "pitfalls": "Tono enfático americano. Exceso de entusiasmo. Falta de ironía.",
            },
        },
        "de-DE": {
            "keywords": ["heritage", "trocken", "geistreich", "tradition", "gut geschrieben"],
            "insights": {
                "tone": "Trocken, kultiviert, kontrollierter Witz. Wenige Superlative. Die Schrift zählt so viel wie das Design.",
                "visual_style": "Heritage-Interieurs neu gedacht, patinierte Materialien (Leder · dunkles Holz · Samt), weiches Londoner Licht.",
                "cta_behavior": "Entdecken, anfragen, Atelier besuchen. Editorial — Wallpaper / House & Garden.",
                "client_expectations": "Editoriale Qualität, kultivierte Verweise, Sorgfalt im Schreiben, Diskretion.",
                "imagery": "Townhouses, Country Houses, Privatclubs, sartoriale Details, editoriale s/w-Porträts.",
                "headlines": "Kurz, gut geschrieben, nie pathetisch. Understatement ist die Signatur.",
                "pitfalls": "Amerikanisch-emphatischer Ton. Übermäßige Begeisterung. Fehlender Humor.",
            },
        },
    },

    "scandinavia": {
        "it-IT": {
            "keywords": ["essenziale", "luminoso", "sincero", "calmo", "naturale"],
            "insights": {
                "tone": "Onesto, diretto, mai eccessivo. Si parla di luce, di legno, di funzione quotidiana. Niente lusso ostentato.",
                "visual_style": "Bianco morbido, legno chiaro, luce nordica diffusa, oggetti pochi e ben scelti, vita reale.",
                "cta_behavior": "Visit our studio, see the collection. Tono pratico, gentile, mai pressante.",
                "client_expectations": "Onestà sui materiali, sostenibilità reale, prezzi trasparenti, durata nel tempo.",
                "imagery": "Interni quotidiani, famiglia, luce naturale, mobili di lunga durata, piante semplici.",
                "headlines": "Frasi piane, oneste. Nessuna metafora ridondante. Un buon prodotto si descrive da sé.",
                "pitfalls": "Luxury heavy. Marmo eccessivo. Ori. Mood scuri. Stock photo di yacht. Linguaggio aspirazionale ostentato.",
            },
        },
        "en-US": {
            "keywords": ["essential", "bright", "honest", "calm", "natural"],
            "insights": {
                "tone": "Honest, direct, never excessive. Light, wood, everyday function. No ostentation.",
                "visual_style": "Soft white, pale wood, diffused Nordic light, few well-chosen objects, real life.",
                "cta_behavior": "Visit our studio, see the collection. Practical, gentle, never pressured.",
                "client_expectations": "Material honesty, real sustainability, transparent pricing, longevity.",
                "imagery": "Everyday interiors, family, natural light, durable furniture, simple plants.",
                "headlines": "Plain, honest. No metaphor overload. A good product speaks for itself.",
                "pitfalls": "Heavy luxury tone. Excess marble. Gold. Dark moods. Yacht stock photos.",
            },
        },
        "en-GB": {
            "keywords": ["essential", "bright", "honest", "calm", "natural"],
            "insights": {
                "tone": "Honest, direct, never excessive. Light, wood, everyday function.",
                "visual_style": "Soft white, pale wood, diffused Nordic light, few well-chosen objects.",
                "cta_behavior": "Visit our studio, see the collection. Practical and gentle.",
                "client_expectations": "Material honesty, real sustainability, transparent pricing, longevity.",
                "imagery": "Everyday interiors, family life, natural light, durable furniture.",
                "headlines": "Plain, honest. No metaphor overload.",
                "pitfalls": "Heavy luxury tone. Excess marble. Yacht imagery.",
            },
        },
        "fr-FR": {
            "keywords": ["essentiel", "lumineux", "sincère", "calme", "naturel"],
            "insights": {
                "tone": "Honnête, direct, jamais excessif. Lumière, bois, fonction quotidienne. Aucune ostentation.",
                "visual_style": "Blanc doux, bois clair, lumière nordique diffuse, peu d'objets bien choisis, vie réelle.",
                "cta_behavior": "Visiter le studio, voir la collection. Pratique, doux, jamais pressant.",
                "client_expectations": "Honnêteté matière, durabilité réelle, prix transparents, longévité.",
                "imagery": "Intérieurs quotidiens, famille, lumière naturelle, mobilier durable, plantes simples.",
                "headlines": "Phrases simples, honnêtes. Pas de métaphores. Un bon produit parle de lui-même.",
                "pitfalls": "Ton luxe lourd. Excès de marbre. Or. Ambiances sombres. Photos de yacht.",
            },
        },
        "es-ES": {
            "keywords": ["esencial", "luminoso", "sincero", "calmo", "natural"],
            "insights": {
                "tone": "Honesto, directo, nunca excesivo. Luz, madera, función diaria. Sin ostentación.",
                "visual_style": "Blanco suave, madera clara, luz nórdica difusa, pocos objetos bien escogidos.",
                "cta_behavior": "Visitar el estudio, ver la colección. Práctico, amable, sin presión.",
                "client_expectations": "Honestidad material, sostenibilidad real, precios transparentes, longevidad.",
                "imagery": "Interiores cotidianos, familia, luz natural, mobiliario duradero, plantas simples.",
                "headlines": "Frases sencillas, honestas. Sin metáforas excesivas.",
                "pitfalls": "Tono lujoso pesado. Exceso de mármol. Oros. Ambientes oscuros.",
            },
        },
        "de-DE": {
            "keywords": ["essenziell", "hell", "ehrlich", "ruhig", "natürlich"],
            "insights": {
                "tone": "Ehrlich, direkt, niemals übertrieben. Licht, Holz, Alltagsfunktion. Keine Zurschaustellung.",
                "visual_style": "Weiches Weiß, helles Holz, diffuses nordisches Licht, wenige gut gewählte Objekte.",
                "cta_behavior": "Studio besuchen, Kollektion sehen. Praktisch, freundlich, nie drängend.",
                "client_expectations": "Material-Ehrlichkeit, echte Nachhaltigkeit, transparente Preise, Langlebigkeit.",
                "imagery": "Alltagsinterieurs, Familie, Naturlicht, langlebige Möbel, einfache Pflanzen.",
                "headlines": "Einfache, ehrliche Sätze. Keine Metaphern-Flut.",
                "pitfalls": "Schwerer Luxuston. Marmor-Überfluss. Yacht-Bildwelt.",
            },
        },
    },

    "spain_iberian": {
        "it-IT": {
            "keywords": ["solare", "mediterraneo", "rilassato", "sociale", "tattile"],
            "insights": {
                "tone": "Caloroso, conviviale, vicino al cliente. Si parla di vita, di patio, di luce mediterranea.",
                "visual_style": "Luce solare, archi, terracotta, intonaci a calce, tessuti naturali, piante mediterranee.",
                "cta_behavior": "Visita allo showroom, scoprire la collezione, prendere appuntamento. Tono caldo, diretto.",
                "client_expectations": "Vicinanza personale, calore relazionale, design che invita a ricevere amici.",
                "imagery": "Patios, finestre aperte, ulivi, cucine grandi, tavoli da pranzo per molti, vita all'aperto.",
                "headlines": "Frasi luminose, accoglienti, mai fredde. Si invita, non si propone.",
                "pitfalls": "Tono nordico distaccato. Mood scuri. Linguaggio troppo tecnico. CTA aggressive.",
            },
        },
        "en-US": {
            "keywords": ["sunlit", "Mediterranean", "relaxed", "social", "tactile"],
            "insights": {
                "tone": "Warm, convivial, close to the client. We speak of life, patio, Mediterranean light.",
                "visual_style": "Sunlight, arches, terracotta, lime plaster, natural fabrics, Mediterranean plants.",
                "cta_behavior": "Visit our showroom, discover the collection, book a consultation. Warm and direct.",
                "client_expectations": "Personal closeness, relational warmth, design that invites hosting.",
                "imagery": "Patios, open windows, olive trees, large kitchens, dining tables for many, outdoor life.",
                "headlines": "Bright, welcoming sentences. We invite, we don't sell.",
                "pitfalls": "Cold Nordic tone. Dark moods. Overly technical language. Aggressive CTAs.",
            },
        },
        "en-GB": {
            "keywords": ["sunlit", "Mediterranean", "relaxed", "social", "tactile"],
            "insights": {
                "tone": "Warm, convivial, close to the client. Life, patio, Mediterranean light.",
                "visual_style": "Sunlight, arches, terracotta, lime plaster, natural fabrics.",
                "cta_behavior": "Visit our showroom, discover the collection. Warm and direct.",
                "client_expectations": "Personal closeness, relational warmth, design for hosting.",
                "imagery": "Patios, open windows, olive trees, large kitchens, outdoor life.",
                "headlines": "Bright, welcoming. We invite, we don't sell.",
                "pitfalls": "Cold Nordic tone. Dark moods. Overly technical language.",
            },
        },
        "fr-FR": {
            "keywords": ["solaire", "méditerranéen", "détendu", "convivial", "tactile"],
            "insights": {
                "tone": "Chaleureux, convivial, proche du client. On parle de vie, de patio, de lumière méditerranéenne.",
                "visual_style": "Soleil, arches, terre cuite, enduits à la chaux, textiles naturels, plantes méditerranéennes.",
                "cta_behavior": "Visiter le showroom, découvrir la collection, prendre rendez-vous. Chaleureux, direct.",
                "client_expectations": "Proximité personnelle, chaleur relationnelle, design qui invite à recevoir.",
                "imagery": "Patios, fenêtres ouvertes, oliviers, grandes cuisines, tables nombreuses, vie en plein air.",
                "headlines": "Phrases lumineuses, accueillantes. On invite, on ne vend pas.",
                "pitfalls": "Ton nordique distant. Ambiances sombres. Langage trop technique.",
            },
        },
        "es-ES": {
            "keywords": ["soleado", "mediterráneo", "relajado", "social", "táctil"],
            "insights": {
                "tone": "Cálido, convivial, cercano al cliente. Se habla de vida, patio, luz mediterránea.",
                "visual_style": "Luz solar, arcos, terracota, cal, tejidos naturales, plantas mediterráneas.",
                "cta_behavior": "Visita el showroom, descubre la colección, pide cita. Cálido y directo.",
                "client_expectations": "Cercanía personal, calidez relacional, diseño que invita a recibir.",
                "imagery": "Patios, ventanas abiertas, olivos, cocinas grandes, mesas para muchos, vida al aire libre.",
                "headlines": "Frases luminosas, acogedoras. Se invita, no se vende.",
                "pitfalls": "Tono nórdico distante. Ambientes oscuros. Lenguaje demasiado técnico.",
            },
        },
        "de-DE": {
            "keywords": ["sonnig", "mediterran", "entspannt", "gesellig", "taktil"],
            "insights": {
                "tone": "Warm, gesellig, kundennah. Wir sprechen von Leben, Patio, mediterranem Licht.",
                "visual_style": "Sonnenlicht, Bögen, Terrakotta, Kalkputz, Naturtextilien, mediterrane Pflanzen.",
                "cta_behavior": "Showroom besuchen, Kollektion entdecken, Termin buchen. Warm und direkt.",
                "client_expectations": "Persönliche Nähe, relationale Wärme, Design für Gastlichkeit.",
                "imagery": "Patios, offene Fenster, Olivenbäume, große Küchen, lange Tische, Outdoor-Leben.",
                "headlines": "Helle, einladende Sätze. Wir laden ein, wir verkaufen nicht.",
                "pitfalls": "Distanzierter nordischer Ton. Dunkle Stimmungen. Zu technische Sprache.",
            },
        },
    },

    # ═══════════════════════════════════ NORTH AMERICA ═════════════════
    "usa_national": {
        "it-IT": {
            "keywords": ["aspirazionale", "diretto", "scenografico", "magazine", "ambizioso"],
            "insights": {
                "tone": "Ambizioso, diretto, magazine-driven. Si vendono sogni, ma con riferimenti progettuali credibili.",
                "visual_style": "Grandi ambienti, soffitti alti, scenografia editoriale, lifestyle aspirational, cucine da chef.",
                "cta_behavior": "Schedule a consultation, get pricing, see availability. Veloce, deciso, con timeline chiaro.",
                "client_expectations": "Risposta rapida, processo trasparente, status di servizio (concierge), portfolio celebrities-safe.",
                "imagery": "Penthouse, beach houses, mountain retreats, kitchen islands, walk-in closets, designer ritratti.",
                "headlines": "Verbi forti, promesse concrete. 'Transform your home in 90 days'. Numeri in chiaro.",
                "pitfalls": "Tono troppo discreto. Mancanza di KPI o timeline. Linguaggio europeo eccessivamente sussurrato.",
            },
        },
        "en-US": {
            "keywords": ["aspirational", "direct", "scenic", "magazine", "ambitious"],
            "insights": {
                "tone": "Ambitious, direct, magazine-driven. We sell dreams — but with credible project references.",
                "visual_style": "Grand rooms, high ceilings, editorial scenery, aspirational lifestyle, chef's kitchens.",
                "cta_behavior": "Schedule a consultation, get pricing, see availability. Fast, decisive, clear timeline.",
                "client_expectations": "Quick response, transparent process, concierge-grade service, celebrity-safe portfolio.",
                "imagery": "Penthouses, beach houses, mountain retreats, kitchen islands, walk-in closets, designer portraits.",
                "headlines": "Strong verbs, concrete promises. 'Transform your home in 90 days'. Real numbers.",
                "pitfalls": "Overly understated tone. Missing KPIs or timelines. Whispered European voice.",
            },
        },
        "en-GB": {
            "keywords": ["aspirational", "direct", "scenic", "magazine", "ambitious"],
            "insights": {
                "tone": "Ambitious, direct, magazine-driven. Selling dreams with credible project references.",
                "visual_style": "Grand rooms, high ceilings, editorial scenery, aspirational lifestyle.",
                "cta_behavior": "Schedule a consultation, get pricing, see availability. Fast and decisive.",
                "client_expectations": "Quick response, transparent process, concierge service, safe portfolio.",
                "imagery": "Penthouses, beach houses, mountain retreats, designer portraits.",
                "headlines": "Strong verbs, concrete promises, real numbers.",
                "pitfalls": "Overly understated. Missing timelines.",
            },
        },
        "fr-FR": {
            "keywords": ["aspirationnel", "direct", "scénique", "magazine", "ambitieux"],
            "insights": {
                "tone": "Ambitieux, direct, esprit magazine. On vend des rêves, avec des références projet crédibles.",
                "visual_style": "Grands volumes, plafonds hauts, scénographie éditoriale, lifestyle aspirationnel, cuisines de chef.",
                "cta_behavior": "Prendre rendez-vous, obtenir un devis, voir les disponibilités. Rapide, décisif, planning clair.",
                "client_expectations": "Réponse rapide, processus transparent, service concierge, portfolio premium.",
                "imagery": "Penthouses, beach houses, retraites de montagne, îlots de cuisine, portraits de designer.",
                "headlines": "Verbes forts, promesses concrètes, chiffres visibles.",
                "pitfalls": "Ton trop discret. Manque de planning. Voix européenne trop chuchotée.",
            },
        },
        "es-ES": {
            "keywords": ["aspiracional", "directo", "escenográfico", "magazine", "ambicioso"],
            "insights": {
                "tone": "Ambicioso, directo, espíritu magazine. Se venden sueños con referencias creíbles.",
                "visual_style": "Espacios grandes, techos altos, escenografía editorial, lifestyle aspiracional, cocinas de chef.",
                "cta_behavior": "Pedir consulta, obtener precio, ver disponibilidad. Rápido, decisivo, calendario claro.",
                "client_expectations": "Respuesta rápida, proceso transparente, servicio concierge, portfolio seguro.",
                "imagery": "Áticos, beach houses, retiros de montaña, islas de cocina, retratos de diseñador.",
                "headlines": "Verbos fuertes, promesas concretas, números visibles.",
                "pitfalls": "Tono demasiado discreto. Falta de calendario. Voz europea susurrada.",
            },
        },
        "de-DE": {
            "keywords": ["aspirativ", "direkt", "szenisch", "magazine", "ambitioniert"],
            "insights": {
                "tone": "Ambitioniert, direkt, magazinhaft. Wir verkaufen Träume — mit glaubwürdigen Projektreferenzen.",
                "visual_style": "Große Räume, hohe Decken, editoriale Szenerie, aspirativer Lifestyle, Chef's Kitchens.",
                "cta_behavior": "Beratung buchen, Preise erhalten, Verfügbarkeit sehen. Schnell, entschlossen, klarer Zeitplan.",
                "client_expectations": "Schnelle Antwort, transparenter Prozess, Concierge-Service, sicheres Portfolio.",
                "imagery": "Penthouses, Beach Houses, Mountain Retreats, Kücheninseln, Designer-Porträts.",
                "headlines": "Starke Verben, konkrete Versprechen, echte Zahlen.",
                "pitfalls": "Zu zurückhaltender Ton. Fehlende Zeitpläne. Geflüsterte europäische Stimme.",
            },
        },
    },

    "usa_east_coast": {
        "it-IT": {
            "keywords": ["sofisticato", "competitivo", "veloce", "autorevole", "architettonico"],
            "insights": {
                "tone": "Veloce, deciso, da business district. New York/Boston/Philadelphia parlano via referrals e velocità d'esecuzione.",
                "visual_style": "Townhouse di brownstone, prewar grandeur, library studies, vista skyline, dettagli in marmo nero.",
                "cta_behavior": "Book a private viewing, request our portfolio, speak with our principal. Tono concierge ma rapido.",
                "client_expectations": "Risposta entro 24h, principal accessibile, references AD/Architectural Digest, NDA.",
                "imagery": "Prewar interiors, Park Avenue, library walls in noce, design firms ritratte come studi legali.",
                "headlines": "Sostantivi forti, ritmo da Wall Street Journal. 'Park Avenue residence · Reimagined for 2026'.",
                "pitfalls": "Tono troppo soft/casual. Mancanza di credenziali architettoniche. Stock photos.",
            },
        },
        "en-US": {
            "keywords": ["sophisticated", "competitive", "fast", "authoritative", "architectural"],
            "insights": {
                "tone": "Fast, decisive, business-district. NYC/Boston/Philly clients run on referrals and execution speed.",
                "visual_style": "Brownstone townhouses, prewar grandeur, library studies, skyline views, black marble details.",
                "cta_behavior": "Book a private viewing, request our portfolio, speak with our principal. Concierge but fast.",
                "client_expectations": "24-hour response, accessible principal, AD/Architectural Digest references, NDA standard.",
                "imagery": "Prewar interiors, Park Avenue, walnut library walls, design firms shown as law firms.",
                "headlines": "Strong nouns, WSJ rhythm. 'Park Avenue residence · Reimagined for 2026'.",
                "pitfalls": "Overly soft/casual tone. Missing architectural credentials. Stock photos.",
            },
        },
        "en-GB": {
            "keywords": ["sophisticated", "competitive", "fast", "authoritative", "architectural"],
            "insights": {
                "tone": "Fast, decisive, business-district. Referrals and execution speed matter.",
                "visual_style": "Brownstone townhouses, prewar grandeur, library studies, skyline views.",
                "cta_behavior": "Book a private viewing, request our portfolio, speak with our principal.",
                "client_expectations": "24-hour response, accessible principal, architectural press references, NDA.",
                "imagery": "Prewar interiors, Park Avenue, walnut library walls.",
                "headlines": "Strong nouns, WSJ rhythm.",
                "pitfalls": "Overly casual. Missing credentials. Stock photos.",
            },
        },
        "fr-FR": {
            "keywords": ["sophistiqué", "compétitif", "rapide", "autoritaire", "architectural"],
            "insights": {
                "tone": "Rapide, décisif, ambiance business district. NYC/Boston/Philadelphie vivent de référencement et de vitesse d'exécution.",
                "visual_style": "Townhouses en brownstone, grandeur prewar, libraries, vues sur skyline, détails marbre noir.",
                "cta_behavior": "Visite privée, dossier portfolio, échange avec le principal. Concierge mais rapide.",
                "client_expectations": "Réponse sous 24h, principal accessible, références AD/Architectural Digest, NDA standard.",
                "imagery": "Intérieurs prewar, Park Avenue, bibliothèques en noyer, design firms façon cabinet d'avocats.",
                "headlines": "Noms forts, rythme WSJ.",
                "pitfalls": "Ton trop soft. Manque de crédentiels architecturaux.",
            },
        },
        "es-ES": {
            "keywords": ["sofisticado", "competitivo", "rápido", "autoritativo", "arquitectónico"],
            "insights": {
                "tone": "Rápido, decisivo, ambiente business district. Clientes NYC/Boston/Philly funcionan por referidos y velocidad.",
                "visual_style": "Townhouses brownstone, grandeza prewar, bibliotecas, vistas al skyline, mármol negro.",
                "cta_behavior": "Visita privada, dossier de portfolio, hablar con el principal. Concierge pero rápido.",
                "client_expectations": "Respuesta en 24h, principal accesible, referencias AD/Architectural Digest, NDA.",
                "imagery": "Interiores prewar, Park Avenue, bibliotecas en nogal, design firms como bufetes.",
                "headlines": "Sustantivos fuertes, ritmo WSJ.",
                "pitfalls": "Tono demasiado soft. Falta de credenciales arquitectónicas.",
            },
        },
        "de-DE": {
            "keywords": ["sophisticated", "kompetitiv", "schnell", "autoritativ", "architektonisch"],
            "insights": {
                "tone": "Schnell, entschlossen, Business-District-Atmosphäre. NYC/Boston/Philly leben von Referrals und Tempo.",
                "visual_style": "Brownstone-Townhouses, Prewar-Grandeur, Library-Studios, Skyline-Blicke, schwarzer Marmor.",
                "cta_behavior": "Private Besichtigung, Portfolio-Dossier, Gespräch mit dem Principal. Concierge, aber schnell.",
                "client_expectations": "24h-Antwort, zugänglicher Principal, AD/Architectural-Digest-Referenzen, NDA.",
                "imagery": "Prewar-Interieurs, Park Avenue, Nussbaum-Bibliotheken, Design-Firms wie Kanzleien.",
                "headlines": "Starke Substantive, WSJ-Rhythmus.",
                "pitfalls": "Zu sanfter Ton. Fehlende architektonische Credentials.",
            },
        },
    },

    "usa_south_florida": {
        "it-IT": {
            "keywords": ["tropicale", "luminoso", "resort", "espressivo", "wellness"],
            "insights": {
                "tone": "Solare, lifestyle resort, indoor-outdoor. Miami/Palm Beach/Naples parlano di vacanza permanente.",
                "visual_style": "Bianco e travertino, vetrate sull'acqua, palme, piscine a sfioro, indoor-outdoor flow.",
                "cta_behavior": "Schedule a private tour, see our waterfront projects. Tono concierge da resort 5★.",
                "client_expectations": "Tempi rapidi (snowbird season), wellness orientation, dock/yacht integration, post-Irma resilience.",
                "imagery": "Ocean-front penthouses, ville coloniali rivisitate, terrazze infinite, palm light, kitchen islands enormi.",
                "headlines": "Lifestyle-driven. 'Waterfront living · Curated' o 'A new Miami chapter'.",
                "pitfalls": "Tono troppo grigio/nordico. Mancanza di natura. Materiali freddi.",
            },
        },
        "en-US": {
            "keywords": ["tropical", "bright", "resort", "expressive", "wellness"],
            "insights": {
                "tone": "Sun-driven, resort-lifestyle, indoor-outdoor. Miami/Palm Beach/Naples speak of permanent vacation.",
                "visual_style": "White and travertine, water-facing glazing, palms, infinity pools, indoor-outdoor flow.",
                "cta_behavior": "Schedule a private tour, see our waterfront projects. 5-star resort concierge tone.",
                "client_expectations": "Fast snowbird timelines, wellness orientation, dock/yacht integration, hurricane-resilient.",
                "imagery": "Ocean-front penthouses, reimagined colonial villas, infinity terraces, palm light, oversized kitchen islands.",
                "headlines": "Lifestyle-driven. 'Waterfront living · Curated' or 'A new Miami chapter'.",
                "pitfalls": "Overly grey/Nordic tone. Missing nature. Cold materials.",
            },
        },
        "en-GB": {
            "keywords": ["tropical", "bright", "resort", "expressive", "wellness"],
            "insights": {
                "tone": "Sun-driven, resort-lifestyle, indoor-outdoor.",
                "visual_style": "White and travertine, water-facing glazing, palms, infinity pools.",
                "cta_behavior": "Schedule a private tour, see our waterfront projects.",
                "client_expectations": "Fast snowbird timelines, wellness, dock integration, hurricane-resilient.",
                "imagery": "Ocean-front penthouses, colonial villas reimagined, infinity terraces.",
                "headlines": "Lifestyle-driven, optimistic.",
                "pitfalls": "Overly Nordic tone. Cold materials.",
            },
        },
        "fr-FR": {
            "keywords": ["tropical", "lumineux", "resort", "expressif", "bien-être"],
            "insights": {
                "tone": "Solaire, resort-lifestyle, indoor-outdoor. Miami/Palm Beach respirent vacances permanentes.",
                "visual_style": "Blanc et travertin, baies sur l'eau, palmiers, piscines à débordement, flux intérieur-extérieur.",
                "cta_behavior": "Visite privée, voir les projets waterfront. Ton concierge 5★ resort.",
                "client_expectations": "Rapidité saison snowbird, orientation wellness, intégration dock/yacht, résilience post-cyclone.",
                "imagery": "Penthouses front de mer, villas coloniales revisitées, terrasses infinies, lumière palmée.",
                "headlines": "Lifestyle-driven, optimiste.",
                "pitfalls": "Ton trop nordique. Matières froides.",
            },
        },
        "es-ES": {
            "keywords": ["tropical", "luminoso", "resort", "expresivo", "bienestar"],
            "insights": {
                "tone": "Solar, resort-lifestyle, indoor-outdoor. Miami/Palm Beach respiran vacaciones permanentes.",
                "visual_style": "Blanco y travertino, vidrieras al agua, palmeras, piscinas infinitas, flujo interior-exterior.",
                "cta_behavior": "Visita privada, ver proyectos waterfront. Tono concierge 5★ resort.",
                "client_expectations": "Rapidez temporada snowbird, bienestar, integración dock/yate, resiliencia post-huracán.",
                "imagery": "Áticos frente al mar, villas coloniales reinterpretadas, terrazas infinitas.",
                "headlines": "Lifestyle-driven, optimistas.",
                "pitfalls": "Tono demasiado nórdico. Materiales fríos.",
            },
        },
        "de-DE": {
            "keywords": ["tropisch", "hell", "resort", "expressiv", "wellness"],
            "insights": {
                "tone": "Sonnig, Resort-Lifestyle, Indoor-Outdoor. Miami/Palm Beach sprechen von Dauer-Ferien.",
                "visual_style": "Weiß und Travertin, Wasserblick-Verglasung, Palmen, Infinity-Pools, Indoor-Outdoor-Flow.",
                "cta_behavior": "Privattour, Waterfront-Projekte ansehen. 5★-Resort-Concierge-Ton.",
                "client_expectations": "Schnelle Snowbird-Termine, Wellness, Dock-/Yacht-Integration, Hurrikan-Resilienz.",
                "imagery": "Ocean-front Penthouses, kolonial neu gedachte Villen, Infinity-Terrassen.",
                "headlines": "Lifestyle-getrieben, optimistisch.",
                "pitfalls": "Zu nordischer Ton. Kalte Materialien.",
            },
        },
    },

    "usa_west_coast": {
        "it-IT": {
            "keywords": ["indoor-outdoor", "naturale", "tech", "wellness", "californiano"],
            "insights": {
                "tone": "Rilassato ma sofisticato, tech-aware, biophilic. LA/SF/Seattle parlano di benessere e contesto naturale.",
                "visual_style": "Canyon modernism, vetrate sliding, legno chiaro, indoor-outdoor seamless, palette terrose, luce del Pacifico.",
                "cta_behavior": "Book a studio walk-through, view our case studies. Tono progettuale, mai pomposo.",
                "client_expectations": "Sostenibilità reale (LEED · WELL), smart home integration, biophilic design, privacy from tech press.",
                "imagery": "Case canyon, retreats nel deserto, vigneti Napa, climbing walls integrated, ulivi californiani.",
                "headlines": "Progettuali, calme. 'Canyon House · 2024–2026'. Niente claim aspirazionali esagerati.",
                "pitfalls": "Tono troppo East Coast formale. Mancanza di sostenibilità. Glam eccessivo.",
            },
        },
        "en-US": {
            "keywords": ["indoor-outdoor", "natural", "tech-aware", "wellness", "Californian"],
            "insights": {
                "tone": "Relaxed but sophisticated, tech-aware, biophilic. LA/SF/Seattle speak of wellness and natural context.",
                "visual_style": "Canyon modernism, sliding glazing, pale wood, seamless indoor-outdoor, earthy palettes, Pacific light.",
                "cta_behavior": "Book a studio walk-through, view our case studies. Project-led, never pompous.",
                "client_expectations": "Real sustainability (LEED · WELL), smart home, biophilic, privacy from tech press.",
                "imagery": "Canyon homes, desert retreats, Napa vineyards, integrated climbing walls, Californian olives.",
                "headlines": "Project-led, calm. 'Canyon House · 2024–2026'. No exaggerated aspirational claims.",
                "pitfalls": "Overly East-Coast formal tone. Missing sustainability. Excess glam.",
            },
        },
        "en-GB": {
            "keywords": ["indoor-outdoor", "natural", "tech-aware", "wellness", "Californian"],
            "insights": {
                "tone": "Relaxed but sophisticated, tech-aware, biophilic.",
                "visual_style": "Canyon modernism, sliding glazing, pale wood, seamless indoor-outdoor.",
                "cta_behavior": "Book a studio walk-through, view our case studies.",
                "client_expectations": "Real sustainability, smart home, biophilic design, privacy from press.",
                "imagery": "Canyon homes, desert retreats, vineyards, integrated wellness.",
                "headlines": "Project-led, calm.",
                "pitfalls": "Overly formal East-Coast tone. Excess glam.",
            },
        },
        "fr-FR": {
            "keywords": ["intérieur-extérieur", "naturel", "tech", "bien-être", "californien"],
            "insights": {
                "tone": "Détendu mais sophistiqué, tech-aware, biophilique. LA/SF/Seattle parlent bien-être et contexte naturel.",
                "visual_style": "Canyon modernism, baies coulissantes, bois clair, fluidité intérieur-extérieur, palettes terreuses.",
                "cta_behavior": "Visite du studio, voir les case studies. Approche projet, jamais pompeuse.",
                "client_expectations": "Durabilité réelle, smart home, biophilique, discrétion vis-à-vis de la presse tech.",
                "imagery": "Maisons de canyon, retraites désertiques, vignobles Napa, oliviers californiens.",
                "headlines": "Approche projet, calme. Pas de claims aspirationnels exagérés.",
                "pitfalls": "Ton trop formel East Coast. Manque de durabilité. Glam excessif.",
            },
        },
        "es-ES": {
            "keywords": ["interior-exterior", "natural", "tech", "bienestar", "californiano"],
            "insights": {
                "tone": "Relajado pero sofisticado, tech-aware, biofílico. LA/SF/Seattle hablan de bienestar y contexto natural.",
                "visual_style": "Canyon modernism, ventanales correderos, madera clara, flujo interior-exterior, paletas terrosas.",
                "cta_behavior": "Visita el studio, ver case studies. Enfoque proyecto, nunca pomposo.",
                "client_expectations": "Sostenibilidad real, smart home, biofílico, discreción ante prensa tech.",
                "imagery": "Casas de canyon, retiros desérticos, viñedos Napa, olivos californianos.",
                "headlines": "Enfoque proyecto, calmas.",
                "pitfalls": "Tono demasiado East Coast formal. Glam excesivo.",
            },
        },
        "de-DE": {
            "keywords": ["indoor-outdoor", "natürlich", "tech", "wellness", "kalifornisch"],
            "insights": {
                "tone": "Entspannt, aber kultiviert, tech-bewusst, biophil. LA/SF/Seattle reden über Wohlbefinden und Natur.",
                "visual_style": "Canyon-Modernism, Schiebeverglasung, helles Holz, fließend indoor-outdoor, erdige Paletten.",
                "cta_behavior": "Studio-Walkthrough, Case Studies ansehen. Projektgeführt, nie pompös.",
                "client_expectations": "Echte Nachhaltigkeit, Smart Home, biophil, Diskretion gegenüber Tech-Presse.",
                "imagery": "Canyon-Häuser, Wüsten-Retreats, Napa-Weinberge, kalifornische Olivenbäume.",
                "headlines": "Projektgeführt, ruhig.",
                "pitfalls": "Zu förmlicher East-Coast-Ton. Glam-Überfluss.",
            },
        },
    },

    # ═══════════════════════════════════ MENA ══════════════════════════
    "gcc_luxury": {
        "it-IT": {
            "keywords": ["cerimoniale", "prestigioso", "scenografico", "hospitality", "alto servizio"],
            "insights": {
                "tone": "Cerimoniale, rispettoso, riferimenti culturali profondi. La famiglia, l'ospitalità e l'eccellenza sono al centro.",
                "visual_style": "Marmo statuario, ottoni, scenografie da majlis contemporaneo, illuminazione drammatica, scala monumentale.",
                "cta_behavior": "Request a private appointment, our team will travel to you. Linguaggio formale, mai informale.",
                "client_expectations": "Servizio concierge totale, white-glove logistics, NDA, traduzione araba, capacità di ricevere VIP.",
                "imagery": "Majlis, marble entry halls, infinity ballroom, dettagli arabeschi reinterpretati, lifestyle hospitality.",
                "headlines": "Cerimoniali, eleganti, in arabo se possibile. 'Riyadh Residence · A New Chapter'.",
                "pitfalls": "Tono informale americano. Stereotipi orientalisti. Iconografia religiosa fuori contesto. Tempi lenti.",
            },
        },
        "en-US": {
            "keywords": ["ceremonial", "prestigious", "scenic", "hospitality", "high-service"],
            "insights": {
                "tone": "Ceremonial, respectful, deep cultural references. Family, hospitality and excellence are central.",
                "visual_style": "Statuary marble, brass, contemporary majlis settings, dramatic lighting, monumental scale.",
                "cta_behavior": "Request a private appointment — our team will travel to you. Formal tone, never casual.",
                "client_expectations": "Full concierge service, white-glove logistics, NDA, Arabic translation, VIP-ready spaces.",
                "imagery": "Majlis, marble entry halls, infinity ballrooms, reinterpreted arabesque details, hospitality lifestyle.",
                "headlines": "Ceremonial, elegant. 'Riyadh Residence · A New Chapter'.",
                "pitfalls": "Casual American tone. Orientalist stereotypes. Out-of-context religious iconography. Slow timelines.",
            },
        },
        "en-GB": {
            "keywords": ["ceremonial", "prestigious", "scenic", "hospitality", "high-service"],
            "insights": {
                "tone": "Ceremonial, respectful, deep cultural references.",
                "visual_style": "Statuary marble, brass, contemporary majlis, dramatic lighting, monumental scale.",
                "cta_behavior": "Request a private appointment, our team travels to you. Formal tone.",
                "client_expectations": "Full concierge service, white-glove logistics, NDA, Arabic translation.",
                "imagery": "Majlis, marble entry halls, infinity ballrooms.",
                "headlines": "Ceremonial, elegant.",
                "pitfalls": "Casual tone. Orientalist stereotypes. Out-of-context religious imagery.",
            },
        },
        "fr-FR": {
            "keywords": ["cérémonial", "prestigieux", "scénique", "hospitalité", "haut service"],
            "insights": {
                "tone": "Cérémonial, respectueux, références culturelles profondes. Famille, hospitalité et excellence au centre.",
                "visual_style": "Marbre statuaire, laitons, scénographies majlis contemporains, éclairage dramatique, échelle monumentale.",
                "cta_behavior": "Demande de rendez-vous privé — notre équipe se déplace. Ton formel, jamais familier.",
                "client_expectations": "Service concierge total, logistique white-glove, NDA, traduction arabe, espaces VIP-ready.",
                "imagery": "Majlis, halls d'entrée en marbre, ballrooms infinis, arabesques réinterprétées, hospitality lifestyle.",
                "headlines": "Cérémonial, élégant.",
                "pitfalls": "Ton américain décontracté. Stéréotypes orientalistes. Iconographie religieuse hors contexte.",
            },
        },
        "es-ES": {
            "keywords": ["ceremonial", "prestigioso", "escenográfico", "hospitalidad", "alto servicio"],
            "insights": {
                "tone": "Ceremonial, respetuoso, referencias culturales profundas. Familia, hospitalidad y excelencia en el centro.",
                "visual_style": "Mármol estatuario, latones, escenografías majlis contemporáneo, iluminación dramática, escala monumental.",
                "cta_behavior": "Pedir cita privada — nuestro equipo viaja. Tono formal, nunca informal.",
                "client_expectations": "Servicio concierge total, logística white-glove, NDA, traducción árabe, espacios VIP-ready.",
                "imagery": "Majlis, halls de mármol, ballrooms infinitos, arabescos reinterpretados.",
                "headlines": "Ceremoniales, elegantes.",
                "pitfalls": "Tono americano informal. Estereotipos orientalistas. Iconografía religiosa fuera de contexto.",
            },
        },
        "de-DE": {
            "keywords": ["zeremoniell", "prestigeträchtig", "szenisch", "hospitality", "high-service"],
            "insights": {
                "tone": "Zeremoniell, respektvoll, tiefe kulturelle Verweise. Familie, Hospitality und Exzellenz im Zentrum.",
                "visual_style": "Statuario-Marmor, Messing, zeitgenössische Majlis-Szenerien, dramatisches Licht, monumentaler Maßstab.",
                "cta_behavior": "Privattermin anfragen — unser Team reist an. Formaler Ton, nie locker.",
                "client_expectations": "Voller Concierge-Service, White-Glove-Logistik, NDA, arabische Übersetzung, VIP-ready Räume.",
                "imagery": "Majlis, Marmor-Eingangshallen, Infinity-Ballrooms, neu interpretierte Arabesken.",
                "headlines": "Zeremoniell, elegant.",
                "pitfalls": "Lockerer amerikanischer Ton. Orientalistische Stereotypen. Religiöse Ikonografie aus dem Kontext.",
            },
        },
    },

    # ═══════════════════════════════════ LATAM ═════════════════════════
    "spanish_mexico": {
        "it-IT": {
            "keywords": ["coloniale", "scultoreo", "artigianale", "calore", "patio"],
            "insights": {
                "tone": "Colto e familiare insieme. Si parla di artigianato locale (talavera · barro · tessitura) e di vita conviviale.",
                "visual_style": "Patios, archi coloniali, talavera, legni scuri tropicali, luce dorata, intonaci a calce caldi.",
                "cta_behavior": "Agendar visita, conocer la colección. Tono caloroso, mai aggressivo.",
                "client_expectations": "Rispetto per l'artigianato messicano, sostenibilità sociale (cooperative artigiane), tempo per costruire fiducia.",
                "imagery": "Patios coloniali, talavera, mercados artesanales, cucine grandi, scultoreo come Barragán, luce dorata.",
                "headlines": "In spagnolo messicano naturale, mai castigliano. Riferimenti a luce, casa, familia.",
                "pitfalls": "Spagnolo castigliano d'Europa. Vocabolario freddo. Ignorare il valore dell'artigianato locale.",
            },
        },
        "en-US": {
            "keywords": ["colonial", "sculptural", "artisanal", "warmth", "patio"],
            "insights": {
                "tone": "Cultured and familial. Local craft (talavera · barro · weaving) and convivial life.",
                "visual_style": "Patios, colonial arches, talavera, tropical dark woods, golden light, warm lime plaster.",
                "cta_behavior": "Book a visit, see the collection. Warm, never pressured.",
                "client_expectations": "Respect for Mexican craft, social sustainability (artisan co-ops), time to build trust.",
                "imagery": "Colonial patios, talavera, artisan markets, large kitchens, Barragán-like sculptural light.",
                "headlines": "Natural Mexican Spanish — never Castilian. References to light, home, family.",
                "pitfalls": "European Castilian. Cold vocabulary. Ignoring local craft value.",
            },
        },
        "en-GB": {
            "keywords": ["colonial", "sculptural", "artisanal", "warmth", "patio"],
            "insights": {
                "tone": "Cultured and familial. Local craft, convivial life.",
                "visual_style": "Patios, colonial arches, talavera, tropical dark woods, golden light.",
                "cta_behavior": "Book a visit, see the collection. Warm, never pressured.",
                "client_expectations": "Respect for Mexican craft, social sustainability, time to build trust.",
                "imagery": "Colonial patios, talavera, artisan markets, sculptural light.",
                "headlines": "Natural, references to light and home.",
                "pitfalls": "European Castilian. Cold vocabulary.",
            },
        },
        "fr-FR": {
            "keywords": ["colonial", "sculptural", "artisanal", "chaleur", "patio"],
            "insights": {
                "tone": "Cultivé et familier. Artisanat local (talavera · barro · tissage) et vie conviviale.",
                "visual_style": "Patios, arches coloniales, talavera, bois sombres tropicaux, lumière dorée, enduits chaux chauds.",
                "cta_behavior": "Réserver une visite, découvrir la collection. Chaleureux, jamais pressant.",
                "client_expectations": "Respect de l'artisanat mexicain, durabilité sociale, temps pour construire la confiance.",
                "imagery": "Patios coloniaux, talavera, marchés artisanaux, grandes cuisines, lumière sculpturale à la Barragán.",
                "headlines": "En espagnol mexicain naturel.",
                "pitfalls": "Castillan européen. Vocabulaire froid.",
            },
        },
        "es-ES": {
            "keywords": ["colonial", "escultórico", "artesanal", "calidez", "patio"],
            "insights": {
                "tone": "Culto y familiar a la vez. Artesanía local (talavera · barro · tejido) y vida conviviale.",
                "visual_style": "Patios, arcos coloniales, talavera, maderas oscuras tropicales, luz dorada, cal cálida.",
                "cta_behavior": "Agendar visita, conocer la colección. Cálido, sin presión.",
                "client_expectations": "Respeto por artesanía mexicana, sostenibilidad social, tiempo para construir confianza.",
                "imagery": "Patios coloniales, talavera, mercados artesanales, cocinas grandes, luz escultórica.",
                "headlines": "Español mexicano natural — no castellano.",
                "pitfalls": "Castellano europeo. Vocabulario frío. Ignorar la artesanía local.",
            },
        },
        "de-DE": {
            "keywords": ["kolonial", "skulptural", "handwerklich", "Wärme", "patio"],
            "insights": {
                "tone": "Kultiviert und familiär. Lokales Handwerk (Talavera · Barro · Weben) und geselliges Leben.",
                "visual_style": "Patios, koloniale Bögen, Talavera, tropisch-dunkles Holz, goldenes Licht, warmer Kalkputz.",
                "cta_behavior": "Besuch buchen, Kollektion ansehen. Warm, nie drängend.",
                "client_expectations": "Respekt für mexikanisches Handwerk, soziale Nachhaltigkeit, Zeit für Vertrauen.",
                "imagery": "Koloniale Patios, Talavera, Handwerksmärkte, große Küchen, Barragán-Lichtskulptur.",
                "headlines": "Natürliches mexikanisches Spanisch.",
                "pitfalls": "Europäisches Kastilisch. Kalte Wortwahl.",
            },
        },
    },

    "spanish_latam": {
        "it-IT": {
            "keywords": ["modernista", "tropicale", "botanico", "sensuale", "scultoreo"],
            "insights": {
                "tone": "Colto, modernista, riferimenti a Niemeyer e Barragán. Si parla di luce, vegetazione, scala monumentale.",
                "visual_style": "Modernismo brasiliano/messicano, vegetazione abbondante, calcestruzzo a vista, vetrate, luce filtrata da palme.",
                "cta_behavior": "Agendar consulta, conocer el portafolio. Tono progettuale, riferimenti modernisti.",
                "client_expectations": "Comprensione della scena modernista latinoamericana, riferimenti accademici, respect for indigenous craft.",
                "imagery": "Modernismo, vegetazione, ville Barragán-like, casa Caetano Veloso, jardim tropical Burle Marx.",
                "headlines": "Riferimenti modernisti, mai turistico-tropicale. 'Casa Modernista · Cuernavaca'.",
                "pitfalls": "Riferimenti turistico-tropicali. Stereotipi 'tropical paradise'. Spagnolo castigliano.",
            },
        },
        "en-US": {
            "keywords": ["modernist", "tropical", "botanical", "sensual", "sculptural"],
            "insights": {
                "tone": "Cultured, modernist, Niemeyer and Barragán references. Light, vegetation, monumental scale.",
                "visual_style": "Brazilian/Mexican modernism, lush vegetation, exposed concrete, glazing, palm-filtered light.",
                "cta_behavior": "Book a consultation, see the portfolio. Project-led, modernist references.",
                "client_expectations": "Understanding of Latin American modernism, academic references, respect for indigenous craft.",
                "imagery": "Modernism, vegetation, Barragán-like villas, Burle Marx tropical gardens.",
                "headlines": "Modernist references — never touristic-tropical. 'Casa Modernista · Cuernavaca'.",
                "pitfalls": "Touristic-tropical references. 'Tropical paradise' stereotypes. Castilian Spanish.",
            },
        },
        "en-GB": {
            "keywords": ["modernist", "tropical", "botanical", "sensual", "sculptural"],
            "insights": {
                "tone": "Cultured, modernist, Niemeyer/Barragán references.",
                "visual_style": "Modernism, lush vegetation, exposed concrete, glazing, filtered light.",
                "cta_behavior": "Book a consultation, see the portfolio.",
                "client_expectations": "Understanding of Latin American modernism, respect for indigenous craft.",
                "imagery": "Modernism, vegetation, Barragán-like villas, Burle Marx tropical gardens.",
                "headlines": "Modernist references — never touristic-tropical.",
                "pitfalls": "Touristic-tropical references. Stereotypes.",
            },
        },
        "fr-FR": {
            "keywords": ["moderniste", "tropical", "botanique", "sensuel", "sculptural"],
            "insights": {
                "tone": "Cultivé, moderniste, références Niemeyer et Barragán. Lumière, végétation, échelle monumentale.",
                "visual_style": "Modernisme brésilien/mexicain, végétation luxuriante, béton brut, baies vitrées, lumière filtrée.",
                "cta_behavior": "Réserver une consultation, voir le portfolio. Projet, références modernistes.",
                "client_expectations": "Compréhension du modernisme latino-américain, références académiques, respect des cultures autochtones.",
                "imagery": "Modernisme, végétation, villas façon Barragán, jardins tropicaux Burle Marx.",
                "headlines": "Références modernistes — jamais touristico-tropical.",
                "pitfalls": "Références touristico-tropicales. Stéréotypes 'paradis tropical'. Castillan.",
            },
        },
        "es-ES": {
            "keywords": ["modernista", "tropical", "botánico", "sensual", "escultórico"],
            "insights": {
                "tone": "Culto, modernista, referencias Niemeyer y Barragán. Luz, vegetación, escala monumental.",
                "visual_style": "Modernismo brasileño/mexicano, vegetación abundante, hormigón visto, ventanales, luz filtrada por palmeras.",
                "cta_behavior": "Agendar consulta, conocer el portfolio. Tono proyecto, referencias modernistas.",
                "client_expectations": "Comprensión del modernismo latinoamericano, referencias académicas, respeto por artesanía indígena.",
                "imagery": "Modernismo, vegetación, villas Barragán-like, jardines Burle Marx.",
                "headlines": "Referencias modernistas — nunca turístico-tropical.",
                "pitfalls": "Referencias turístico-tropicales. Estereotipos. Castellano europeo en territorios mexicanos.",
            },
        },
        "de-DE": {
            "keywords": ["modernistisch", "tropisch", "botanisch", "sinnlich", "skulptural"],
            "insights": {
                "tone": "Kultiviert, modernistisch, Niemeyer- und Barragán-Verweise. Licht, Vegetation, monumentaler Maßstab.",
                "visual_style": "Brasilianischer/mexikanischer Modernismus, üppige Vegetation, Sichtbeton, Verglasung, palmengefiltertes Licht.",
                "cta_behavior": "Beratung buchen, Portfolio ansehen. Projektgeführt, modernistische Verweise.",
                "client_expectations": "Verständnis für lateinamerikanischen Modernismus, akademische Verweise, Respekt vor indigenem Handwerk.",
                "imagery": "Modernismus, Vegetation, Barragán-artige Villen, Burle-Marx-Gärten.",
                "headlines": "Modernistische Verweise — nie touristisch-tropisch.",
                "pitfalls": "Touristisch-tropische Verweise. 'Tropisches Paradies'-Klischees.",
            },
        },
    },

    "central_america": {
        "it-IT": {
            "keywords": ["coloniale", "tropicale", "artigianale", "patio", "indoor-outdoor"],
            "insights": {
                "tone": "Familiare, colto, riferimenti coloniali e artigianali (talavera · maiolica · tessitura).",
                "visual_style": "Patios coloniali, vegetazione, archi, intonaci a calce, ceramiche dipinte, indoor-outdoor.",
                "cta_behavior": "Agendar visita al estudio, conocer la colección. Tono familiare e diretto.",
                "client_expectations": "Rispetto per artigianato locale, comprensione della tradizione coloniale, tempi pacati.",
                "imagery": "Antigua Guatemala, San José coloniale, Granada (Nicaragua), patios fioriti, mercati artesanales.",
                "headlines": "In spagnolo locale, naturale. Niente claim aspirazionali.",
                "pitfalls": "Tono USA aggressivo. Castigliano europeo. Ignorare il colonialismo storico.",
            },
        },
        "en-US": {
            "keywords": ["colonial", "tropical", "artisanal", "patio", "indoor-outdoor"],
            "insights": {
                "tone": "Familial, cultured, colonial and artisanal references.",
                "visual_style": "Colonial patios, vegetation, arches, lime plaster, painted ceramics, indoor-outdoor.",
                "cta_behavior": "Book a studio visit, see the collection. Familial and direct.",
                "client_expectations": "Respect for local craft, understanding of colonial tradition, calm timelines.",
                "imagery": "Antigua Guatemala, colonial San José, Granada (Nicaragua), flower-filled patios.",
                "headlines": "Natural local Spanish. No aspirational claims.",
                "pitfalls": "Aggressive US tone. European Castilian. Ignoring colonial history.",
            },
        },
        "en-GB": {
            "keywords": ["colonial", "tropical", "artisanal", "patio", "indoor-outdoor"],
            "insights": {
                "tone": "Familial, cultured, colonial and artisanal references.",
                "visual_style": "Colonial patios, vegetation, arches, lime plaster, painted ceramics.",
                "cta_behavior": "Book a studio visit, see the collection.",
                "client_expectations": "Respect for local craft, understanding of tradition, calm timelines.",
                "imagery": "Antigua Guatemala, colonial San José, Granada Nicaragua.",
                "headlines": "Natural, no aspirational claims.",
                "pitfalls": "Aggressive US tone. Ignoring colonial history.",
            },
        },
        "fr-FR": {
            "keywords": ["colonial", "tropical", "artisanal", "patio", "intérieur-extérieur"],
            "insights": {
                "tone": "Familier, cultivé, références coloniales et artisanales.",
                "visual_style": "Patios coloniaux, végétation, arches, enduits chaux, céramiques peintes, intérieur-extérieur.",
                "cta_behavior": "Visite du studio, voir la collection. Familier et direct.",
                "client_expectations": "Respect de l'artisanat local, compréhension de la tradition coloniale, rythme calme.",
                "imagery": "Antigua Guatemala, San José colonial, Granada (Nicaragua), patios fleuris.",
                "headlines": "Espagnol local naturel.",
                "pitfalls": "Ton US agressif. Castillan européen.",
            },
        },
        "es-ES": {
            "keywords": ["colonial", "tropical", "artesanal", "patio", "interior-exterior"],
            "insights": {
                "tone": "Familiar, culto, referencias coloniales y artesanales.",
                "visual_style": "Patios coloniales, vegetación, arcos, cal, cerámicas pintadas, interior-exterior.",
                "cta_behavior": "Visita al estudio, conocer la colección. Familiar y directo.",
                "client_expectations": "Respeto por artesanía local, comprensión de tradición colonial, ritmos calmos.",
                "imagery": "Antigua Guatemala, San José colonial, Granada Nicaragua, patios floridos.",
                "headlines": "Español local natural.",
                "pitfalls": "Tono US agresivo. Castellano europeo. Ignorar la historia colonial.",
            },
        },
        "de-DE": {
            "keywords": ["kolonial", "tropisch", "handwerklich", "patio", "indoor-outdoor"],
            "insights": {
                "tone": "Familiär, kultiviert, koloniale und handwerkliche Verweise.",
                "visual_style": "Koloniale Patios, Vegetation, Bögen, Kalkputz, bemalte Keramik, indoor-outdoor.",
                "cta_behavior": "Studio-Besuch buchen, Kollektion ansehen. Familiär, direkt.",
                "client_expectations": "Respekt vor lokalem Handwerk, Verständnis kolonialer Tradition, ruhige Termine.",
                "imagery": "Antigua Guatemala, koloniales San José, Granada Nicaragua, blühende Patios.",
                "headlines": "Natürliches lokales Spanisch.",
                "pitfalls": "Aggressiver US-Ton. Europäisches Kastilisch.",
            },
        },
    },

    "brazil": {
        "it-IT": {
            "keywords": ["modernista", "sensuale", "tropicale", "scultoreo", "botanico"],
            "insights": {
                "tone": "Sensuale, modernista, riferimenti a Niemeyer, Lina Bo Bardi, Burle Marx. La natura è dentro la casa.",
                "visual_style": "Modernismo brasiliano, calcestruzzo a vista, vegetazione tropicale, vetrate enormi, palette terrose calde.",
                "cta_behavior": "Agendar uma visita, conhecer o portfolio. Tono caloroso, mai aggressivo.",
                "client_expectations": "Comprensione del modernismo carioca/paulista, riferimenti accademici, design botanico integrato.",
                "imagery": "Casa di Niemeyer/Bardi, vegetazione tropicale, calcestruzzo poetico, jardim Burle Marx, samba della luce.",
                "headlines": "Portoghese brasiliano caldo. Riferimenti modernisti.",
                "pitfalls": "Portoghese europeo. Stereotipi 'carnival'. Ignorare la profondità modernista.",
            },
        },
        "en-US": {
            "keywords": ["modernist", "sensual", "tropical", "sculptural", "botanical"],
            "insights": {
                "tone": "Sensual, modernist, Niemeyer/Lina Bo Bardi/Burle Marx references. Nature inside the home.",
                "visual_style": "Brazilian modernism, exposed concrete, tropical vegetation, vast glazing, warm earthy palettes.",
                "cta_behavior": "Book a visit, see the portfolio. Warm, never aggressive.",
                "client_expectations": "Understanding of carioca/paulista modernism, academic references, integrated botanical design.",
                "imagery": "Niemeyer/Bardi houses, tropical vegetation, poetic concrete, Burle Marx gardens, samba of light.",
                "headlines": "Warm Brazilian Portuguese. Modernist references.",
                "pitfalls": "European Portuguese. 'Carnival' stereotypes. Ignoring modernist depth.",
            },
        },
        "en-GB": {
            "keywords": ["modernist", "sensual", "tropical", "sculptural", "botanical"],
            "insights": {
                "tone": "Sensual, modernist, Niemeyer/Bo Bardi/Burle Marx references.",
                "visual_style": "Brazilian modernism, exposed concrete, tropical vegetation, vast glazing.",
                "cta_behavior": "Book a visit, see the portfolio.",
                "client_expectations": "Understanding of carioca/paulista modernism, integrated botanical design.",
                "imagery": "Niemeyer/Bardi houses, tropical vegetation, Burle Marx gardens.",
                "headlines": "Warm Brazilian Portuguese.",
                "pitfalls": "European Portuguese. 'Carnival' stereotypes.",
            },
        },
        "fr-FR": {
            "keywords": ["moderniste", "sensuel", "tropical", "sculptural", "botanique"],
            "insights": {
                "tone": "Sensuel, moderniste, références Niemeyer/Lina Bo Bardi/Burle Marx. La nature dans la maison.",
                "visual_style": "Modernisme brésilien, béton brut, végétation tropicale, immenses baies vitrées, palettes terreuses chaudes.",
                "cta_behavior": "Réserver une visite, voir le portfolio. Chaleureux, jamais agressif.",
                "client_expectations": "Compréhension du modernisme carioca/paulista, références académiques, design botanique intégré.",
                "imagery": "Maisons Niemeyer/Bardi, végétation tropicale, béton poétique, jardins Burle Marx.",
                "headlines": "Portugais brésilien chaleureux.",
                "pitfalls": "Portugais européen. Stéréotypes 'carnaval'.",
            },
        },
        "es-ES": {
            "keywords": ["modernista", "sensual", "tropical", "escultórico", "botánico"],
            "insights": {
                "tone": "Sensual, modernista, referencias Niemeyer/Lina Bo Bardi/Burle Marx. La naturaleza dentro de la casa.",
                "visual_style": "Modernismo brasileño, hormigón visto, vegetación tropical, ventanales enormes, paletas terrosas cálidas.",
                "cta_behavior": "Agendar visita, conocer el portfolio. Cálido, nunca agresivo.",
                "client_expectations": "Comprensión del modernismo carioca/paulista, referencias académicas, diseño botánico integrado.",
                "imagery": "Casas Niemeyer/Bardi, vegetación tropical, jardines Burle Marx.",
                "headlines": "Portugués brasileño cálido.",
                "pitfalls": "Portugués europeo. Estereotipos 'carnaval'.",
            },
        },
        "de-DE": {
            "keywords": ["modernistisch", "sinnlich", "tropisch", "skulptural", "botanisch"],
            "insights": {
                "tone": "Sinnlich, modernistisch, Niemeyer/Lina Bo Bardi/Burle Marx-Verweise. Natur im Haus.",
                "visual_style": "Brasilianischer Modernismus, Sichtbeton, tropische Vegetation, riesige Verglasung, warme erdige Paletten.",
                "cta_behavior": "Besuch buchen, Portfolio ansehen. Warm, nie aggressiv.",
                "client_expectations": "Verständnis für Carioca/Paulista-Modernismus, akademische Verweise, integriertes botanisches Design.",
                "imagery": "Niemeyer/Bardi-Häuser, tropische Vegetation, Burle-Marx-Gärten.",
                "headlines": "Warmes brasilianisches Portugiesisch.",
                "pitfalls": "Europäisches Portugiesisch. 'Karneval'-Klischees.",
            },
        },
    },
}


# ───────────────────────────────────────────────────────────────────────
def main():
    url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    updated, skipped = 0, 0
    for code, payload in MARKET_INTELLIGENCE.items():
        cur.execute("SELECT id, code FROM markets WHERE code=%s", (code,))
        row = cur.fetchone()
        if not row:
            print(f"  [skip] market not found: {code}")
            skipped += 1
            continue
        market_id = row[0]
        intelligence = {
            "keywords": {locale: payload[locale]["keywords"] for locale in payload},
            "insights": {locale: payload[locale]["insights"] for locale in payload},
        }
        cur.execute(
            "UPDATE markets SET market_intelligence=%s::jsonb, updated_at=NOW() WHERE id=%s",
            (json.dumps(intelligence, ensure_ascii=False), market_id),
        )
        updated += 1
        print(f"  [ok] {code} → {len(payload)} locales seeded")
    conn.commit()
    cur.close()
    conn.close()
    print(f"\nSeeded {updated} markets · skipped {skipped}")


if __name__ == "__main__":
    main()
