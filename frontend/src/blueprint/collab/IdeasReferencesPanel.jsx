/**
 * IdeasReferencesPanel — client-side reference uploads inside Review Mode.
 *
 *  Named deliberately NOT "Upload". Editorial framing:
 *    "Share Your Ideas" — drop images / PDFs / paste links that inspire you.
 *
 *  - Drag & drop zone (also supports manual file picker)
 *  - Live grid of references already shared
 *  - Each upload triggers identity capture if needed
 */
import React, { useRef, useState } from 'react';
import { Plus, Upload, FileText, ImageIcon } from 'lucide-react';

const ASSET_ICON = { image: ImageIcon, pdf: FileText, link: Plus };

const IdeasReferencesPanel = ({ inspirations = [], onUpload, uploading, asClient }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => onUpload(f));
  };

  return (
    <section className="space-y-4" data-testid="ideas-references-panel">
      {/* Drop zone — only shown to the client (designers see read-only feed). */}
      {asClient && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          data-testid="ideas-references-dropzone"
          className={`block cursor-pointer rounded-[3px] border border-dashed
                      ${dragOver
                        ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/8'
                        : 'border-[var(--bp-border-strong)] hover:border-[var(--bp-text-muted)]'}
                      px-5 py-7 text-center transition-colors`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            data-testid="ideas-references-file-input"
          />
          <Upload size={16} strokeWidth={1.25}
                  className="mx-auto mb-2 text-[var(--bp-text-muted)]" />
          <p className="text-[12px] text-[var(--bp-text-secondary)] leading-relaxed">
            {uploading
              ? 'Sharing your reference…'
              : 'Drop an image or PDF — or click to choose.'}
          </p>
          <p className="text-[10px] text-[var(--bp-text-subtle)] mt-1">
            Pinterest screenshots welcome.
          </p>
        </label>
      )}

      {/* Grid */}
      {inspirations.length === 0 ? (
        <p className="text-[12px] text-[var(--bp-text-muted)] italic">
          No references shared yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {inspirations.map((i) => {
            const Icon = ASSET_ICON[i.type] || Plus;
            return (
              <div key={i.id}
                   data-testid={`inspiration-tile-${i.id}`}
                   title={i.title || i.description || ''}
                   className="relative aspect-square rounded-[2px] overflow-hidden
                              border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/60
                              group">
                {i.thumbnail_url || i.asset_url ? (
                  <img src={i.thumbnail_url || i.asset_url}
                       alt={i.title || ''}
                       loading="lazy"
                       className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--bp-text-muted)]">
                    <Icon size={16} strokeWidth={1.25} />
                  </div>
                )}
                {i.uploaded_by_name && (
                  <span className="absolute bottom-0 inset-x-0 px-1.5 py-1
                                   text-[9px] tracking-wider uppercase
                                   bg-gradient-to-t from-black/65 to-transparent
                                   text-white/85 opacity-0 group-hover:opacity-100
                                   transition-opacity truncate">
                    {i.uploaded_by_name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default IdeasReferencesPanel;
