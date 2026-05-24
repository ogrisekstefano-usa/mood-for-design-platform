/**
 * MediaSystemPreviewPage · internal smoke surface for the Phase-2
 * Media System Unificato™. NOT linked from sidebar — admin-only.
 *
 * Lets the studio verify:
 *   · `UnifiedMediaPickerModal` opens and reads the live archive
 *   · 8 atelier filter presets render
 *   · Used-In™ panel queries are paginating
 */
import React, { useState } from 'react';
import UnifiedMediaPickerModal from '../../components/media/UnifiedMediaPickerModal';

const MediaSystemPreviewPage = () => {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0807', color: '#F2EFE6', padding: '64px 48px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <p style={{ fontSize: 12, letterSpacing: '0.32em', textTransform: 'uppercase', color: '#C9A26B', fontWeight: 600, marginBottom: 14 }}>
        Media System Unificato™ · preview
      </p>
      <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 64, lineHeight: 1.02, margin: '0 0 18px', fontWeight: 400, fontStyle: 'italic' }}>
        One library. One picker.
      </h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 720, color: 'rgba(242,239,230,0.78)', margin: '0 0 40px' }}>
        Hard rule: every component that needs an image goes through the
        same modal. Master assets are immutable; variants are metadata.
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="ump-preview-open"
        style={{
          padding: '16px 28px',
          background: '#C9A26B', color: '#061616',
          border: '1px solid #C9A26B',
          fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Open the Media Library
      </button>

      {picked && (
        <div data-testid="ump-preview-picked" style={{ marginTop: 32, padding: 24, border: '1px solid rgba(255,255,255,0.10)', maxWidth: 560 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C9A26B', fontWeight: 600, marginBottom: 10 }}>
            Last pick
          </p>
          <h3 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 28, margin: '0 0 8px', fontWeight: 400, fontStyle: 'italic' }}>
            {picked.asset?.title || picked.asset?.file_name}
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(242,239,230,0.66)', margin: 0 }}>
            filter · {picked.filter_preset}
          </p>
        </div>
      )}

      <UnifiedMediaPickerModal
        open={open}
        onClose={() => setOpen(false)}
        onPick={(payload) => setPicked(payload)}
      />
    </div>
  );
};

export default MediaSystemPreviewPage;
