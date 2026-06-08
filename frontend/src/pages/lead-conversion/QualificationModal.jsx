/**
 * STORE-005 · Lead → Prospect → Design Journey™
 * QualificationModal — 4 essenziali domande (Spotlight-style).
 * Su submit: PATCH /api/leads/{id}/qualify; se qualified → onComplete().
 */
import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';

const PROJECT_TYPES = ['Kitchen','Living','Bathroom','Bedroom','Outdoor','Office','Retail','Hospitality','Full Home','Other'];
const SPACE_STATUS  = [{v:'yes',l:'Sì, definito'},{v:'looking',l:'Lo sto cercando'},{v:'not_yet',l:'Non ancora'}];
const TIMELINES    = [{v:'30d',l:'Entro 30 giorni'},{v:'1-3m',l:'1–3 mesi'},{v:'3-6m',l:'3–6 mesi'},{v:'6m+',l:'Oltre 6 mesi'},{v:'exploring',l:'Sto esplorando'}];
const INTERESTS    = [{v:'yes',l:'Sì'},{v:'maybe',l:'Forse'},{v:'not_now',l:'Non adesso'}];

const overlayStyle = { position:'fixed', inset:0, background:'rgba(7,8,11,0.78)', backdropFilter:'blur(10px)', zIndex:90, display:'flex', alignItems:'center', justifyContent:'center', padding:24 };
const cardStyle    = { width:'min(540px,100%)', background:'#0E1015', border:'1px solid rgba(255,255,255,0.10)', borderRadius:14, padding:'28px 28px 22px', color:'#F3EFE8', fontFamily:'Inter, system-ui, sans-serif' };
const eyebrowStyle = { fontSize:10, fontWeight:600, letterSpacing:'0.30em', textTransform:'uppercase', color:'#6FE4D2', margin:0 };
const titleStyle   = { fontFamily:'var(--atelier-serif, serif)', fontWeight:300, fontSize:26, margin:'10px 0 14px', letterSpacing:'-0.01em', color:'#F3EFE8' };
const subStyle     = { fontSize:13, color:'rgba(243,239,232,0.62)', margin:'0 0 18px', lineHeight:1.45 };
const chipStyle = (active)=>({ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:999, border: active ? '1px solid #6FE4D2':'1px solid rgba(255,255,255,0.16)', background: active ? 'rgba(111,228,210,0.10)':'transparent', color: active ? '#6FE4D2':'#F3EFE8', fontSize:12.5, fontWeight:500, cursor:'pointer', marginRight:6, marginBottom:6, fontFamily:'Inter, sans-serif' });
const btn          = (variant='ghost')=>({ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background: variant==='primary' ? '#6FE4D2':'transparent', color: variant==='primary' ? '#07080B':'#F3EFE8', fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'Inter, sans-serif' });
const closeStyle   = { position:'absolute', top:14, right:14, background:'transparent', border:'none', color:'rgba(243,239,232,0.5)', cursor:'pointer' };

const QualificationModal = ({ leadId, leadName, onComplete, onClose }) => {
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState([]);
  const [spaceStatus, setSpaceStatus] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [interest, setInterest] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const total = 4;
  const canNext = [projectType.length>0, !!spaceStatus, !!timeline, !!interest][step];

  const toggleProjectType = (v) => {
    setProjectType((curr) => curr.includes(v) ? curr.filter(x=>x!==v) : [...curr,v]);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await api.post(`/api/leads/${leadId}/qualify`, {
        project_type: projectType,
        space_status: spaceStatus,
        timeline,
        interest,
      });
      onComplete && onComplete(r.data);
    } catch (e) {
      console.warn('[qualify] failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} role="dialog" data-testid="qualification-modal">
      <div style={{ ...cardStyle, position:'relative' }}>
        <button type="button" style={closeStyle} onClick={onClose} data-testid="qualification-close" aria-label="Close">
          <X size={18} />
        </button>
        <p style={eyebrowStyle}>Qualification™ · Step {step+1} of {total}</p>
        <h2 style={titleStyle}>Possiamo aiutarti?</h2>
        {leadName && <p style={subStyle}>{leadName}</p>}

        {step === 0 && (
          <div data-testid="q-step-1">
            <p style={{ ...subStyle, color:'#F3EFE8', marginBottom:10 }}>Cosa stai progettando?</p>
            <div>
              {PROJECT_TYPES.map((p)=>(
                <button key={p} type="button" style={chipStyle(projectType.includes(p))} onClick={()=>toggleProjectType(p)} data-testid={`q-project-${p.toLowerCase().replace(/\s/g,'-')}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div data-testid="q-step-2">
            <p style={{ ...subStyle, color:'#F3EFE8', marginBottom:10 }}>Hai già uno spazio definito?</p>
            <div>
              {SPACE_STATUS.map((o)=>(
                <button key={o.v} type="button" style={chipStyle(spaceStatus===o.v)} onClick={()=>setSpaceStatus(o.v)} data-testid={`q-space-${o.v}`}>{o.l}</button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div data-testid="q-step-3">
            <p style={{ ...subStyle, color:'#F3EFE8', marginBottom:10 }}>Quando pensi di iniziare?</p>
            <div>
              {TIMELINES.map((o)=>(
                <button key={o.v} type="button" style={chipStyle(timeline===o.v)} onClick={()=>setTimeline(o.v)} data-testid={`q-timeline-${o.v}`}>{o.l}</button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div data-testid="q-step-4">
            <p style={{ ...subStyle, color:'#F3EFE8', marginBottom:10 }}>Vorresti una proposta di design?</p>
            <div>
              {INTERESTS.map((o)=>(
                <button key={o.v} type="button" style={chipStyle(interest===o.v)} onClick={()=>setInterest(o.v)} data-testid={`q-interest-${o.v}`}>{o.l}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, gap:8 }}>
          <button type="button" style={btn('ghost')} onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} data-testid="q-back">
            <ArrowLeft size={13}/> Indietro
          </button>
          {step < total - 1 ? (
            <button type="button" style={btn('primary')} onClick={()=>setStep(step+1)} disabled={!canNext} data-testid="q-next">
              Avanti <ArrowRight size={13}/>
            </button>
          ) : (
            <button type="button" style={btn('primary')} onClick={submit} disabled={!canNext||submitting} data-testid="q-submit">
              <CheckCircle2 size={13}/> Crea Design Journey
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualificationModal;
