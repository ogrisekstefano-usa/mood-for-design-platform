"""
ITER167 — Seed editorial blocks for site.access.*

Namespace conventions:
  site.access.<slot> where slots are:
    eyebrow, headline, sublead,
    email.label, email.placeholder, email.continue,
    password.label, password.continue, password.helper,
    magic.headline, magic.body, magic.cta_resend, magic.helper,
    concierge.headline, concierge.body, concierge.cta,
    expired.headline, expired.body, expired.cta,
    already_used.headline, already_used.body,
    welcome_back.headline, welcome_back.body,
    legal_note,
    nav.label

Tone: hospitality / luxury / editorial. NO jargon ("login", "auth", "error",
"sign in", "credentials"). All copy reads like an invitation.
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY: dict[str, dict[str, str]] = {
    # ── Nav label ─────────────────────────────────────────────────────
    "nav.label": {
        "it":    "Accedi",
        "en-us": "Enter",
        "fr":    "Accéder",
        "de":    "Eintreten",
        "es":    "Acceder",
    },

    # ── First screen: email entry ─────────────────────────────────────
    "eyebrow": {
        "it":    "MOOD for DESIGN",
        "en-us": "MOOD for DESIGN",
        "fr":    "MOOD for DESIGN",
        "de":    "MOOD for DESIGN",
        "es":    "MOOD for DESIGN",
    },
    "headline": {
        "it":    "Continua il tuo Design Journey.",
        "en-us": "Continue your Design Journey.",
        "fr":    "Poursuivez votre Design Journey.",
        "de":    "Setzen Sie Ihre Design Journey fort.",
        "es":    "Continúa tu Design Journey.",
    },
    "sublead": {
        "it":    "Inserisci l'indirizzo email associato al tuo spazio progettuale. Ti accompagniamo dentro.",
        "en-us": "Enter the email tied to your editorial workspace. We'll walk you in.",
        "fr":    "Indiquez l'adresse e-mail liée à votre espace éditorial. Nous vous accompagnons.",
        "de":    "Geben Sie die E-Mail-Adresse Ihres editorialen Raums ein. Wir begleiten Sie hinein.",
        "es":    "Introduce el correo asociado a tu espacio editorial. Te acompañamos dentro.",
    },
    "email.label": {
        "it":    "Email",
        "en-us": "Email",
        "fr":    "E-mail",
        "de":    "E-Mail",
        "es":    "Correo",
    },
    "email.placeholder": {
        "it":    "nome@studio.com",
        "en-us": "name@studio.com",
        "fr":    "nom@studio.com",
        "de":    "name@studio.com",
        "es":    "nombre@studio.com",
    },
    "email.continue": {
        "it":    "Continua",
        "en-us": "Continue",
        "fr":    "Continuer",
        "de":    "Weiter",
        "es":    "Continuar",
    },

    # ── Password channel (admin/staff) ────────────────────────────────
    "password.label": {
        "it":    "Parola d'accesso",
        "en-us": "Access phrase",
        "fr":    "Phrase d'accès",
        "de":    "Zugangsphrase",
        "es":    "Frase de acceso",
    },
    "password.continue": {
        "it":    "Entra nel tuo spazio",
        "en-us": "Enter your space",
        "fr":    "Entrer dans votre espace",
        "de":    "Ihren Raum betreten",
        "es":    "Entra en tu espacio",
    },
    "password.helper": {
        "it":    "Preferisci un link senza parola d'accesso? Te lo inviamo per email.",
        "en-us": "Prefer a passwordless link? We can send one to your inbox.",
        "fr":    "Vous préférez un lien sans mot de passe ? Nous pouvons vous l'envoyer.",
        "de":    "Lieber ein passwortloser Link? Wir senden ihn an Ihren Posteingang.",
        "es":    "¿Prefieres un enlace sin contraseña? Te lo enviamos al correo.",
    },

    # ── Magic link sent (client channel) ──────────────────────────────
    "magic.headline": {
        "it":    "Il tuo link d'accesso è in viaggio.",
        "en-us": "Your access link is on its way.",
        "fr":    "Votre lien d'accès est en chemin.",
        "de":    "Ihr Zugangslink ist unterwegs.",
        "es":    "Tu enlace de acceso está en camino.",
    },
    "magic.body": {
        "it":    "Apri la tua casella di posta per continuare. Il link è valido 15 minuti e ti porta direttamente dentro il tuo Design Journey.",
        "en-us": "Open your inbox to continue. The link is valid for 15 minutes and brings you straight into your Design Journey.",
        "fr":    "Ouvrez votre boîte de réception pour continuer. Le lien reste valide 15 minutes et vous mène directement à votre Design Journey.",
        "de":    "Öffnen Sie Ihren Posteingang, um fortzufahren. Der Link ist 15 Minuten gültig und führt Sie direkt in Ihre Design Journey.",
        "es":    "Abre tu bandeja para continuar. El enlace es válido 15 minutos y te lleva directo a tu Design Journey.",
    },
    "magic.cta_resend": {
        "it":    "Invia di nuovo",
        "en-us": "Send again",
        "fr":    "Renvoyer",
        "de":    "Erneut senden",
        "es":    "Reenviar",
    },
    "magic.helper": {
        "it":    "Non vedi nulla? Controlla anche la cartella promozioni.",
        "en-us": "Nothing yet? Check your promotions folder as well.",
        "fr":    "Rien encore ? Pensez à vérifier vos promotions.",
        "de":    "Noch nichts? Schauen Sie auch in den Werbeordner.",
        "es":    "¿Aún nada? Revisa también tu carpeta de promociones.",
    },

    # ── Concierge (unknown email or soft block) ───────────────────────
    "concierge.headline": {
        "it":    "Non abbiamo trovato un Design Journey attivo per questa email.",
        "en-us": "We couldn't match this email to an active workspace.",
        "fr":    "Aucun espace actif ne correspond à cette adresse pour l'instant.",
        "de":    "Wir konnten dieser Adresse noch keinen aktiven Raum zuordnen.",
        "es":    "Aún no encontramos un espacio activo para este correo.",
    },
    "concierge.body": {
        "it":    "Il tuo invito potrebbe essere ancora in approvazione. Lo studio MOOD for DESIGN può continuare il percorso insieme a te.",
        "en-us": "Your invitation may still be pending approval. The MOOD for DESIGN studio can continue the journey with you.",
        "fr":    "Votre invitation est peut-être encore en cours d'approbation. Le studio MOOD for DESIGN peut poursuivre le parcours avec vous.",
        "de":    "Ihre Einladung wartet möglicherweise noch auf Freigabe. Das MOOD for DESIGN Studio begleitet Sie gern weiter.",
        "es":    "Tu invitación podría seguir pendiente de aprobación. El estudio MOOD for DESIGN puede continuar el recorrido contigo.",
    },
    "concierge.cta": {
        "it":    "Scrivici",
        "en-us": "Reach out to us",
        "fr":    "Nous contacter",
        "de":    "Schreiben Sie uns",
        "es":    "Escríbenos",
    },

    # ── Expired link landing ──────────────────────────────────────────
    "expired.headline": {
        "it":    "Questa sessione si è chiusa con grazia.",
        "en-us": "This session has gracefully closed.",
        "fr":    "Cette session s'est refermée en douceur.",
        "de":    "Diese Sitzung hat sich behutsam geschlossen.",
        "es":    "Esta sesión se ha cerrado con calma.",
    },
    "expired.body": {
        "it":    "Richiedi un nuovo link d'accesso per continuare il tuo Design Journey, esattamente da dove l'hai lasciato.",
        "en-us": "Request a new access link to continue your Design Journey, exactly where you left it.",
        "fr":    "Demandez un nouveau lien d'accès pour reprendre votre Design Journey à l'endroit même où vous l'aviez laissé.",
        "de":    "Fordern Sie einen neuen Zugangslink an, um Ihre Design Journey genau dort fortzusetzen, wo Sie aufgehört haben.",
        "es":    "Solicita un nuevo enlace de acceso para retomar tu Design Journey exactamente donde lo dejaste.",
    },
    "expired.cta": {
        "it":    "Richiedi un nuovo link",
        "en-us": "Request a new link",
        "fr":    "Demander un nouveau lien",
        "de":    "Neuen Link anfordern",
        "es":    "Solicitar un nuevo enlace",
    },

    # ── Already used ──────────────────────────────────────────────────
    "already_used.headline": {
        "it":    "Questo invito è già stato accolto.",
        "en-us": "This invitation has already been welcomed.",
        "fr":    "Cette invitation a déjà été honorée.",
        "de":    "Diese Einladung wurde bereits angenommen.",
        "es":    "Esta invitación ya ha sido recibida.",
    },
    "already_used.body": {
        "it":    "Per maggiore tranquillità ogni link è valido una sola volta. Possiamo aprirti subito un nuovo accesso.",
        "en-us": "For your peace of mind every link is single-use. We can open a new access for you right away.",
        "fr":    "Pour votre tranquillité, chaque lien n'est utilisable qu'une fois. Nous pouvons vous en ouvrir un nouveau immédiatement.",
        "de":    "Aus Sorgfalt ist jeder Link nur einmal verwendbar. Wir öffnen Ihnen sofort einen neuen Zugang.",
        "es":    "Por tranquilidad, cada enlace es de uso único. Podemos abrirte un nuevo acceso de inmediato.",
    },

    # ── Welcome back (successful consume) ─────────────────────────────
    "welcome_back.headline": {
        "it":    "Bentornato nel tuo Design Journey.",
        "en-us": "Welcome back to your Design Journey.",
        "fr":    "Heureux de vous revoir dans votre Design Journey.",
        "de":    "Willkommen zurück in Ihrer Design Journey.",
        "es":    "Bienvenido de nuevo a tu Design Journey.",
    },
    "welcome_back.body": {
        "it":    "Stiamo aprendo il tuo spazio progettuale.",
        "en-us": "We're opening your editorial workspace.",
        "fr":    "Nous ouvrons votre espace éditorial.",
        "de":    "Wir öffnen Ihren editorialen Raum.",
        "es":    "Estamos abriendo tu espacio editorial.",
    },

    # ── Inline microcopy ──────────────────────────────────────────────
    "loading.preparing": {
        "it":    "Preparazione dell'accesso…",
        "en-us": "Preparing your access…",
        "fr":    "Préparation de votre accès…",
        "de":    "Ihr Zugang wird vorbereitet…",
        "es":    "Preparando tu acceso…",
    },
    "loading.opening": {
        "it":    "Apertura del tuo Design Journey…",
        "en-us": "Opening your Design Journey…",
        "fr":    "Ouverture de votre Design Journey…",
        "de":    "Ihre Design Journey wird geöffnet…",
        "es":    "Abriendo tu Design Journey…",
    },
    "loading.verifying": {
        "it":    "Verifica del tuo accesso…",
        "en-us": "Verifying your access…",
        "fr":    "Vérification de votre accès…",
        "de":    "Ihr Zugang wird überprüft…",
        "es":    "Verificando tu acceso…",
    },

    # ── Footer / legal note ───────────────────────────────────────────
    "legal_note": {
        "it":    "MOOD for DESIGN protegge il tuo accesso con riservatezza editoriale. Niente password salvate sui server quando scegli il link.",
        "en-us": "MOOD for DESIGN safeguards your access with editorial discretion. No stored passwords when you choose the link.",
        "fr":    "MOOD for DESIGN protège votre accès avec une discrétion éditoriale. Aucun mot de passe stocké lorsque vous choisissez le lien.",
        "de":    "MOOD for DESIGN schützt Ihren Zugang mit editorialer Diskretion. Bei Wahl des Links werden keine Passwörter gespeichert.",
        "es":    "MOOD for DESIGN protege tu acceso con discreción editorial. Ningún password almacenado cuando eliges el enlace.",
    },
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    inserted = 0
    updated  = 0
    async with AsyncSessionLocal() as s:
        for block_key, locales in COPY.items():
            namespace = "site.access"
            source_value = locales.get("it") or next(iter(locales.values()))
            # Upsert the block row
            row = (await s.execute(
                text("""
                    INSERT INTO editorial_blocks
                      (id, scope, tenant_id, namespace, block_key, block_type,
                       source_locale, source_value, source_hash, is_active,
                       created_at, updated_at)
                    VALUES (gen_random_uuid(), 'tenant', :tid, :ns, :bk, 'body',
                            'it', :sv, '', true, NOW(), NOW())
                    ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                       SET source_value = EXCLUDED.source_value,
                           updated_at   = NOW()
                    RETURNING id, (xmax = 0) AS inserted
                """),
                {"tid": tenant_id, "ns": namespace, "bk": block_key, "sv": source_value},
            )).first()
            block_id = row[0]
            if row[1]:
                inserted += 1
            else:
                updated += 1
            # Upsert each locale's translation
            for locale, value in locales.items():
                await s.execute(
                    text("""
                        INSERT INTO editorial_block_translations
                          (id, block_id, locale, value, status, generated_by,
                           source_hash, locked, created_at, updated_at)
                        VALUES (gen_random_uuid(), :bid, :loc, :val, 'manual',
                                'system-seed', '', false, NOW(), NOW())
                        ON CONFLICT (block_id, locale) DO UPDATE
                           SET value = EXCLUDED.value, updated_at = NOW()
                    """),
                    {"bid": block_id, "loc": locale, "val": value},
                )
        await s.commit()
    print(f"site.access seed: {inserted} new, {updated} refreshed "
          f"({sum(len(v) for v in COPY.values())} translations).")


if __name__ == "__main__":
    asyncio.run(seed())
