import React, { useRef, useState } from 'react';
import { Upload, X, FileIcon } from 'lucide-react';
import { FieldShell } from './_shared';

const FileUploadField = ({ field, value, onChange, locale, error }) => {
  const fileRef = useRef();
  const files = Array.isArray(value) ? value : (value ? [value] : []);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setUploading(true);
    // For MVP: keep file metadata only (name, size, type). Real upload to Supabase
    // can be wired via /api/storage/sign-url next iteration.
    const meta = list.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    onChange([...files, ...meta]);
    setUploading(false);
    e.target.value = '';
  };

  const remove = (i) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <FieldShell field={field} locale={locale} error={error}>
      <button type="button" onClick={() => fileRef.current?.click()}
        data-testid={`upload-${field.key}`}
        className="w-full border-2 border-dashed border-[var(--bp-border-strong)] hover:border-[var(--bp-primary)] rounded-[var(--bp-radius-md)] p-10 text-center transition-colors group">
        <Upload size={20} strokeWidth={1.5} className="mx-auto text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] mb-3" />
        <p className="bp-body text-[var(--bp-text-secondary)]">
          {uploading ? 'Uploading…' : 'Drop files or click to browse'}
        </p>
        <p className="bp-caption text-[var(--bp-text-subtle)] mt-1">Up to 20 MB · PDF, JPG, PNG</p>
      </button>
      <input ref={fileRef} type="file" multiple onChange={handleFiles} className="hidden" />
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)]">
              <FileIcon size={14} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
              <span className="bp-caption text-[var(--bp-text-primary)] flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => remove(i)} className="text-[var(--bp-text-muted)] hover:text-red-400">
                <X size={13} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </FieldShell>
  );
};
export default FileUploadField;
