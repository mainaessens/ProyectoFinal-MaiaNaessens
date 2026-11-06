import { useCallback, useEffect, useState } from 'react';
import { api, initToken, saveToken } from './api.js';
import Md from './Md.jsx';
import Planes from './Planes.jsx';
import Consola from './Consola.jsx';

const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--brand)" />
    <path d="M16 6l5 18H11z" fill="var(--accent)" />
    <path d="M6 10l6 2M26 10l-6 2" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function Login({ onToken, error }) {
  const [t, setT] = useState('');
  return (
    <main className="login">
      <Logo />
      <h1>Faro</h1>
      <p className="muted">Pegá el token que imprime el servidor al iniciar (<code>npm start</code>).</p>
      <form onSubmit={(e) => { e.preventDefault(); onToken(t.trim()); }} className="row grow">
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Token" autoFocus />
        <button className="primary" disabled={!t.trim()}>Entrar</button>
      </form>
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}

function Analisis({ items }) {
  const [sel, setSel] = useState(0);
  if (!items.length) {
    return <div className="card"><p className="muted">Todavía no hay análisis de Instagram. Ejecutá <code>/analisis-cuenta</code> desde la sección Agente (usa los datos reales de la cuenta).</p></div>;
  }
  const actual = items[Math.min(sel, items.length - 1)];
  return (
    <div className="stack">
      <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
        {items.map((a, i) => <option key={a.archivo} value={i}>{a.archivo}</option>)}
      </select>
      <div className="card"><Md>{actual.texto}</Md></div>
    </div>
  );
}

const TABS = [['planes', 'Planes'], ['analisis', 'Análisis'], ['calendario', 'Calendario'], ['perfil', 'Perfil'], ['aprendizajes', 'Aprendizajes'], ['actividad', 'Actividad']];

function Cliente({ token, slug, onRun }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('planes');
  const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    try { setData(await api(token, `/clientes/${slug}`)); setErr(''); } catch (e) { setErr(e.message); }
  }, [token, slug]);
  useEffect(() => { setData(null); cargar(); }, [cargar]);

  if (err) return <div className="banner bad">{err}</div>;
  if (!data) return <p className="muted">Cargando…</p>;
  const pend = data.planes.filter((p) => p.aprobado !== true && p.estado !== 'rechazado').length;

  return (
    <>
      <header className="page-head">
        <div><h2>{slug}</h2><p className="muted small">{data.planes.length} planes · {pend} pendientes de aprobación</p></div>
        <button className="primary" onClick={() => onRun(slug)}>Ejecutar skill</button>
      </header>
      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
      {tab === 'planes' && <Planes token={token} slug={slug} planes={data.planes} onChange={cargar} />}
      {tab === 'analisis' && <Analisis items={data.analisis || []} />}
      {tab === 'calendario' && <div className="card"><Md>{data.calendario}</Md></div>}
      {tab === 'perfil' && <div className="card"><Md>{data.perfil}</Md></div>}
      {tab === 'aprendizajes' && <div className="card"><Md>{data.aprendizajes}</Md></div>}
      {tab === 'actividad' && (
        <div className="card">
          {data.actividad.length
            ? <ul className="log">{data.actividad.map((l, i) => <li key={i}>{l}</li>)}</ul>
            : <p className="muted">Sin actividad registrada.</p>}
        </div>
      )}
    </>
  );
}

function Inicio({ clientes, onOpen }) {
  return (
    <>
      <header className="page-head"><div><h2>Clientes</h2><p className="muted small">Cuentas gestionadas por el agente</p></div></header>
      <div className="grid-cards">
        {clientes.map((c) => (
          <button key={c.slug} className="card client" onClick={() => onOpen(c.slug)}>
            <strong>{c.nombre}</strong>
            <span className="muted small">{c.slug}</span>
            <div className="row">
              {c.planes.pendientes > 0 && <span className="pill warn">{c.planes.pendientes} por aprobar</span>}
              <span className="pill">{c.planes.aprobados} aprobados</span>
            </div>
            {c.ultimaActividad && <span className="muted small clip">{c.ultimaActividad}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(initToken);
  const [error, setError] = useState('');
  const [clientes, setClientes] = useState(null);
  const [skills, setSkills] = useState([]);
  const [view, setView] = useState({ name: 'inicio' });

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const [c, s] = await Promise.all([api(token, '/clientes'), api(token, '/skills')]);
      setClientes(c); setSkills(s); setError('');
    } catch (e) {
      if (e.status === 401) { setToken(''); setError('Token inválido.'); } else setError(e.message);
    }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar, view.name === 'inicio']);

  if (!token) return <Login error={error} onToken={(t) => { saveToken(t); setToken(t); }} />;

  return (
    <div className="shell">
      <aside>
        <div className="brand"><Logo /><div><strong>Faro</strong><span className="muted small">panel de la agencia</span></div></div>
        <button className={`nav ${view.name === 'inicio' ? 'on' : ''}`} onClick={() => setView({ name: 'inicio' })}>Clientes</button>
        <button className={`nav ${view.name === 'agente' ? 'on' : ''}`} onClick={() => setView({ name: 'agente' })}>Agente</button>
        <div className="side-label">Cuentas</div>
        {(clientes || []).map((c) => (
          <button key={c.slug} className={`nav sub ${view.slug === c.slug ? 'on' : ''}`} onClick={() => setView({ name: 'cliente', slug: c.slug })}>
            {c.slug}{c.planes.pendientes > 0 && <span className="badge">{c.planes.pendientes}</span>}
          </button>
        ))}
      </aside>
      <main>
        {error && <div className="banner bad">{error}</div>}
        {view.name === 'inicio' && clientes && <Inicio clientes={clientes} onOpen={(slug) => setView({ name: 'cliente', slug })} />}
        {view.name === 'cliente' && <Cliente token={token} slug={view.slug} onRun={(slug) => setView({ name: 'agente', slug })} />}
        {view.name === 'agente' && (
          <>
            <header className="page-head"><div><h2>Agente</h2><p className="muted small">Ejecutá un skill y seguí el trabajo en vivo</p></div></header>
            <Consola token={token} skills={skills} clientes={clientes || []} preCliente={view.slug} />
          </>
        )}
      </main>
    </div>
  );
}
