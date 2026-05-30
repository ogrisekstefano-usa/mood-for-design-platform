/**
 * initials.js · ITER173 · shared monogram helper
 *
 * Sorgente unica di verità per il monogramma utente/referente.
 * Identico al pattern usato in ClientUserMenu (1° lettera nome + 1° lettera
 * cognome, fallback su prima lettera email, fallback su '·').
 *
 * Accetta qualunque oggetto persona con first_name / last_name / name / email.
 */
export function initialsOf(person) {
  if (!person) return '·';
  const fn = (person.first_name || '').trim();
  const ln = (person.last_name || '').trim();
  if (fn || ln) {
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  }
  // Fallback: split "name" (es: "Stefano Ogrisek")
  const name = (person.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  // Fallback: prima lettera email
  return (person.email || '·')[0].toUpperCase();
}
