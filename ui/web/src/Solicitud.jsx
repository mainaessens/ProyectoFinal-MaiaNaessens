import { useState } from 'react';

// Resumen legible de lo que la herramienta va a hacer (sin volcar JSON enorme).
function detalle(tool, input) {
  if (!input || typeof input !== 'object') return '';
  const campo = input.command ?? input.file_path ?? input.path ?? input.url ?? input.query ?? input.pattern;
  if (typeof campo === 'string') return campo.slice(0, 600);
  const j = JSON.stringify(input, null, 2);
  return j.length > 700 ? `${j.slice(0, 700)}…` : j;
}

function Permiso({ pedido, onResponder }) {
  return (
    <div className="card pedido">
      <div className="pedido-cab"><span className="pill warn">Permiso</span><strong>{pedido.tool}</strong></div>
      <p className="muted small">El agente quiere usar esta herramienta{pedido.descripcion ? `: ${pedido.descripcion}` : '.'}</p>
      {detalle(pedido.tool, pedido.input) && <pre className="detalle">{detalle(pedido.tool, pedido.input)}</pre>}
      <div className="row end">
        <button className="ghost danger" onClick={() => onResponder(pedido.id, { permitir: false })}>Denegar</button>
        {pedido.puedeSiempre && <button className="ghost" onClick={() => onResponder(pedido.id, { permitir: true, siempre: true })}>Permitir siempre en esta sesión</button>}
        <button className="primary" onClick={() => onResponder(pedido.id, { permitir: true })}>Permitir</button>
      </div>
    </div>
  );
}

const OTRO = '__otro__';

function Pregunta({ pedido, onResponder }) {
  const preguntas = Array.isArray(pedido.input?.questions) ? pedido.input.questions : [];
  // sel[i]: Set de etiquetas elegidas; otro[i]: texto libre
  const [sel, setSel] = useState(() => preguntas.map(() => new Set()));
  const [otro, setOtro] = useState(() => preguntas.map(() => ''));

  const toggle = (i, valor, multi) => setSel((s) => s.map((x, j) => {
    if (j !== i) return x;
    const n = new Set(multi ? x : []);
    if (x.has(valor) && multi) n.delete(valor); else n.add(valor);
    return n;
  }));

  // Respuesta de una pregunta: etiquetas elegidas y, si marcó «Otro», su texto.
  const respuestaDe = (i) => {
    const q = preguntas[i];
    const items = [...sel[i]].filter((v) => v !== OTRO);
    if (sel[i].has(OTRO)) { const t = otro[i].trim(); if (!t) return null; items.push(t); }
    if (!items.length) return null;
    return q.multiSelect ? items : items[0];
  };
  const respuestas = preguntas.map((_, i) => respuestaDe(i));
  const completo = preguntas.length > 0 && respuestas.every((r) => r !== null);

  if (!preguntas.length) {
    return <Permiso pedido={pedido} onResponder={onResponder} />; // formato inesperado: se trata como permiso
  }

  return (
    <div className="card pedido">
      <div className="pedido-cab"><span className="pill ok">Pregunta del agente</span></div>
      {preguntas.map((q, i) => (
        <fieldset key={i} className="pregunta">
          <legend>{q.header && <span className="chip">{q.header}</span>} {q.question}</legend>
          {(q.options || []).map((o) => (
            <label key={o.label} className="opcion">
              <input type={q.multiSelect ? 'checkbox' : 'radio'} name={`${pedido.id}-${i}`} checked={sel[i].has(o.label)} onChange={() => toggle(i, o.label, q.multiSelect)} />
              <span><strong>{o.label}</strong>{o.description && <em className="muted small"> · {o.description}</em>}</span>
            </label>
          ))}
          <label className="opcion">
            <input type={q.multiSelect ? 'checkbox' : 'radio'} name={`${pedido.id}-${i}`} checked={sel[i].has(OTRO)} onChange={() => toggle(i, OTRO, q.multiSelect)} />
            <span>Otro:</span>
            <input className="otro" value={otro[i]} maxLength={500} placeholder="Escribí tu respuesta"
              onFocus={() => !sel[i].has(OTRO) && toggle(i, OTRO, q.multiSelect)}
              onChange={(e) => setOtro((o) => o.map((x, j) => (j === i ? e.target.value : x)))} />
          </label>
        </fieldset>
      ))}
      <div className="row end">
        <button className="ghost danger" onClick={() => onResponder(pedido.id, { cancelar: true })}>Cancelar pregunta</button>
        <button className="primary" disabled={!completo} onClick={() => onResponder(pedido.id, { respuestas })}>Enviar respuesta</button>
      </div>
    </div>
  );
}

export default function Solicitudes({ pedidos, onResponder }) {
  if (!pedidos.length) return null;
  return (
    <div className="stack" role="region" aria-label="Pedidos del agente">
      {pedidos.map((p) => (p.tool === 'AskUserQuestion'
        ? <Pregunta key={p.id} pedido={p} onResponder={onResponder} />
        : <Permiso key={p.id} pedido={p} onResponder={onResponder} />))}
    </div>
  );
}
