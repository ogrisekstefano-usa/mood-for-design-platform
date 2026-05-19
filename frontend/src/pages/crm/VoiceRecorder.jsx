/**
 * VoiceRecorder — Voice note recorder + Whisper STT uploader.
 *
 * Uses the native MediaRecorder API (no extra deps). On stop, POSTs the
 * audio blob to /api/relationships/accounts/{aid}/voice-notes which:
 *   1. uploads it to Supabase Storage
 *   2. transcribes with Whisper (best-effort)
 *   3. creates an `interactions` row of type "voice_note"
 *
 * Designed for both desktop modal and mobile FAB flows.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const VoiceRecorder = ({ accountId, locale = 'it-IT', onSaved, onClose }) => {
  const [phase, setPhase] = useState('idle');   // idle | recording | preview | uploading
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Prefer webm/opus → Whisper-supported and tiny
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        setBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        setPhase('preview');
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setSeconds(0);
      setPhase('recording');
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast.error('Microfono non disponibile · controlla i permessi del browser');
    }
  };

  const stop = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    try { recorderRef.current?.stop(); } catch {}
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setBlob(null); setAudioUrl(null); setSeconds(0); setPhase('idle');
  };

  const upload = async () => {
    if (!blob) return;
    setPhase('uploading');
    try {
      const ext = (blob.type.includes('webm') ? 'webm'
        : blob.type.includes('mp4') ? 'm4a'
        : blob.type.includes('ogg') ? 'ogg' : 'webm');
      const fd = new FormData();
      fd.append('file', blob, `voice-${Date.now()}.${ext}`);
      fd.append('locale', locale);
      fd.append('duration_sec', String(seconds));
      const r = await api.post(`/api/relationships/accounts/${accountId}/voice-notes`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const ok = r.data?.transcript_ok;
      toast.success(ok ? 'Nota vocale salvata · transcript pronto' : 'Nota vocale salvata');
      onSaved?.(r.data.interaction);
      reset();
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error('Upload nota vocale fallito');
      setPhase('preview');
    }
  };

  return (
    <div className="rl-voice" data-testid="voice-recorder">
      {phase === 'idle' && (
        <>
          <button type="button" className="rl-voice__mic"
                  onClick={start} data-testid="voice-record-start">
            <Mic size={32} strokeWidth={1.5} />
          </button>
          <p className="rl-voice__status">Tocca per registrare una nota vocale</p>
        </>
      )}
      {phase === 'recording' && (
        <>
          <button type="button" className="rl-voice__mic rl-voice__mic--recording"
                  onClick={stop} data-testid="voice-record-stop">
            <Square size={28} strokeWidth={1.6} />
          </button>
          <p className="rl-voice__status">Registrazione…</p>
          <p className="rl-voice__time" data-testid="voice-timer">{fmtTime(seconds)}</p>
        </>
      )}
      {(phase === 'preview' || phase === 'uploading') && (
        <>
          <div className="rl-voice__preview">
            {audioUrl && <audio src={audioUrl} controls data-testid="voice-preview-audio" />}
          </div>
          <p className="rl-voice__status">Durata · {fmtTime(seconds)}</p>
          <div className="rl-modal__actions">
            <button type="button" className="rl-btn rl-btn--ghost"
                    onClick={reset} disabled={phase === 'uploading'} data-testid="voice-discard">
              <Trash2 size={12} style={{ marginRight: 6 }} /> Scarta
            </button>
            <button type="button" className="rl-btn rl-btn--primary"
                    onClick={upload} disabled={phase === 'uploading'} data-testid="voice-save">
              {phase === 'uploading' ? 'Trascrivo…' : 'Salva & Trascrivi'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;
