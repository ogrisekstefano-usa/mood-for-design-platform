// asErrorString — normalizza qualunque payload errore (string · array Pydantic v2 · obj)
// in una stringa sicura da renderizzare in React.
export const asErrorString = (e, fallback = 'Errore') => {
  const d = e?.response?.data?.detail ?? e?.response?.data ?? e?.message;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map((x) => (x && typeof x === 'object' ? (x.msg || x.message || JSON.stringify(x)) : String(x))).join(' · ');
  }
  if (typeof d === 'object') {
    return d.msg || d.message || JSON.stringify(d);
  }
  return String(d);
};

export default asErrorString;
