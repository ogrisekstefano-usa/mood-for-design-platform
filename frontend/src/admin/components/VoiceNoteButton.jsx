/**
 * VoiceNoteButton — record short voice notes, transcribe via Whisper.
 *
 * Usage:
 *   <VoiceNoteButton
 *     onTranscript={(text) => set('notes', form.notes + (form.notes ? '\n' : '') + text)}
 *     language="it"
 *     testIdRoot="contact-notes"
 *   />
 *
 * Flow:
 *   1. Click mic → request getUserMedia({audio:true}), start MediaRecorder
 *   2. While recording, button turns red, shows MM:SS counter, click again to stop
 *   3. On stop → POST /api/transcribe (multipart) → text appended via callback
 *   4. Errors surface inline (no toast lib required)
 *
 * The transcription is given to the parent which decides where to put it.
 * The user then proof-reads in the textarea before saving the record.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Mic, Square, Loader2 } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const MAX_SECONDS = 180; // hard cap to protect bandwidth & latency

const fmtMS = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
};

export default function VoiceNoteButton({
  onTranscript,
  language = 'it',
  testIdRoot = 'voice',
  size = 'sm',
}) {
  const [state, setState] = useState('idle'); // idle | recording | transcribing | error
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);

  useEffect(() => {
    return () => {
      // safety: stop on unmount
      if (tickRef.current) clearInterval(tickRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTimer = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const start = async () => {
    setError(null); setSeconds(0); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick mime supported by the browser; Whisper accepts webm/opus.
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''];
      const mime = candidates.find((m) => !m || MediaRecorder.isTypeSupported(m)) || '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await transcribe(blob);
      };
      rec.start();
      setState('recording');
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { try { rec.stop(); } catch {} }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setError(e?.message || 'Microfono non disponibile');
      setState('error');
    }
  };

  const stop = () => {
    try { recorderRef.current?.stop(); } catch {}
  };

  const transcribe = async (blob) => {
    setState('transcribing');
    try {
      const fd = new FormData();
      const ext = (blob.type || '').includes('mp4') ? 'mp4'
                : (blob.type || '').includes('ogg') ? 'ogg'
                : 'webm';
      fd.append('file', blob, `voice.${ext}`);
      fd.append('language', language);
      const { data } = await axios.post(
        `${BACKEND}/api/transcribe`,
        fd,
        { headers: {
            Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        });
      const text = (data?.text || '').trim();
      if (!text) {
        setError('Trascrizione vuota');
        setState('error');
      } else {
        onTranscript?.(text);
        setState('idle');
        setSeconds(0);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Errore trascrizione';
      setError(typeof detail === 'string' ? detail : 'Errore trascrizione');
      setState('error');
    }
  };

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const iconSize = size === 'sm' ? 12 : 14;

  if (state === 'recording') {
    return (
      <button type="button"
              onClick={stop}
              data-testid={`${testIdRoot}-voice-stop`}
              className={`inline-flex items-center gap-1.5 ${padding} text-[10.5px] uppercase tracking-wider bg-red-500/15 border border-red-500/50 text-red-400 hover:bg-red-500/25 rounded`}>
        <Square size={iconSize} className="fill-red-400" />
        <span className="tabular-nums">{fmtMS(seconds)}</span>
        <span className="ml-0.5">Stop</span>
      </button>
    );
  }
  if (state === 'transcribing') {
    return (
      <button type="button"
              disabled
              data-testid={`${testIdRoot}-voice-transcribing`}
              className={`inline-flex items-center gap-1.5 ${padding} text-[10.5px] uppercase tracking-wider border border-stone-300 text-stone-400 rounded cursor-wait`}>
        <Loader2 size={iconSize} className="animate-spin" />
        Trascrivo…
      </button>
    );
  }
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button type="button"
              onClick={start}
              data-testid={`${testIdRoot}-voice-start`}
              title="Registra nota vocale → trascrizione AI"
              className={`inline-flex items-center gap-1.5 ${padding} text-[10.5px] uppercase tracking-wider border border-[#00C9B3]/40 text-[#00C9B3] hover:bg-[#00C9B3]/10 rounded`}>
        <Mic size={iconSize} />
        Voce
      </button>
      {error && (
        <span data-testid={`${testIdRoot}-voice-error`}
              className="text-[10px] text-red-400 max-w-[180px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
