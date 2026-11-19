import { useCallback, useEffect, useState } from 'react';
import { api, initToken, saveToken } from './api.js';
import Md from './Md.jsx';
import Planes from './Planes.jsx';
import Consola from './Consola.jsx';
import Disenos from './Disenos.jsx';
import Videos from './Videos.jsx';

const Logo = () => <span className="mono" aria-hidden="true">F</span>;

const leerTema = () => { try { return localStorage.getItem('faro-tema') || 'light'; } catch { return 'light'; } };
const Encabezado = () => {
  const [tema, setTema] = useState(leerTema);
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem('faro-tema', tema); } catch { /* sin almacenamiento */ }
  }, [tema]);
  return (
    <header className="inst">
      <img src="/logo-unt.webp" alt="Universidad Nacional de Tucumán" className="inst-logo unt" />
      <div className="inst-titulo">
        <span className="inst-kicker">Proyecto final</span>
        <strong>Maia G. Naessens</strong>
        <span className="inst-sub">Universidad Nacional de Tucumán · CEDITE</span>
      </div>
      <div className="inst-der">
        <button className="tema" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')} title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar entre modo claro y oscuro">{tema === 'dark' ? '☀' : '☾'}</button>
        <img src="/logo-cedite.png" alt="CEDITE" className="inst-logo cedite" />
      </div>
    </header>
  );
};

const Pie = () => (
  <footer className="pie"><span>Proyecto final · Maia G. Naessens · 2026</span><span>Universidad Nacional de Tucumán · CEDITE</span></footer>
);

function Login({ onToken, error }) {
  const [t, setT] = useState('');
  return (
    <>
    <Encabezado />
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
    </>
  );
}

function Tendencias({ items }) {
  const [sel, setSel] = useState(0);
  if (!items.length) {
    return <div className="card"><p className="muted">Todavía no hay informes de tendencias. Se generan al ejecutar <code>/campania-mensual</code> (investiga formatos, fechas y temas en alza del nicho y guarda el resumen con sus fuentes).</p></div>;
  }
  const actual = items[Math.min(sel, items.length - 1)];
  return (
    <div className="stack">
      {items.length > 1 && (
        <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
          {items.map((t, i) => <option key={t.archivo} value={i}>{t.archivo.replace(/^tendencias-|.md$/g, '')}</option>)}
        </select>
      )}
      <div className="card"><Md>{actual.texto}</Md></div>
    </div>
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

const TABS = [['planes', 'Planes'], ['disenos', 'Diseños'], ['videos', 'Videos'], ['analisis', 'Análisis'], ['tendencias', 'Tendencias'], ['calendario', 'Calendario'], ['perfil', 'Perfil'], ['aprendizajes', 'Aprendizajes'], ['actividad', 'Actividad']];

function Cliente({ token, slug, onRun, onPedido }) {
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
      {tab === 'disenos' && <Disenos token={token} slug={slug} onPedido={onPedido} />}
      {tab === 'videos' && <Videos token={token} slug={slug} onPedido={onPedido} />}
      {tab === 'tendencias' && <Tendencias items={data.tendenciasLista || []} />}
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
  const [corriendo, setCorriendo] = useState(false); // hay un skill en ejecución (aunque se esté en otra vista)
  const [esperando, setEsperando] = useState(0);      // pedidos del agente (preguntas, permisos) que esperan respuesta
  const [aviso, setAviso] = useState(false);          // un skill terminó mientras se miraba otra vista
  const [pedido, setPedido] = useState(null);          // ejecución pedida desde otra vista (ej. «Pedir cambios» en Diseños)

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
  useEffect(() => { if (view.name === 'agente') setAviso(false); }, [view]);
  useEffect(() => {
    document.title = esperando ? '? Faro (el agente espera tu respuesta)' : corriendo ? '● Faro (ejecutando)' : aviso ? '• Faro (el agente terminó)' : 'Faro — panel de la agencia';
  }, [corriendo, aviso, esperando]);

  if (!token) return <Login error={error} onToken={(t) => { saveToken(t); setToken(t); }} />;

  return (
    <>
    <Encabezado />
    <div className="shell">
      <aside>
        <div className="brand"><Logo /><div><strong>Faro</strong><span className="muted small">panel de la agencia</span></div></div>
        <button className={`nav ${view.name === 'inicio' ? 'on' : ''}`} onClick={() => setView({ name: 'inicio' })}>Clientes</button>
        <button className={`nav ${view.name === 'agente' ? 'on' : ''}`} onClick={() => setView({ name: 'agente' })}>
          Agente
          {esperando > 0 && <span className="estado esperando" title="El agente te hizo una pregunta o pidió un permiso"><i className="punto" />responder{esperando > 1 ? ` (${esperando})` : ''}</span>}
          {esperando === 0 && corriendo && <span className="estado corriendo" title="Hay un skill ejecutándose"><i className="spin" />ejecutando</span>}
          {esperando === 0 && !corriendo && aviso &&<span className="estado listo" title="El agente terminó: hay algo para revisar o responder"><i className="punto" />terminó</span>}
        </button>
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
        {view.name === 'cliente' && <Cliente token={token} slug={view.slug} onRun={(slug) => setView({ name: 'agente', slug })}
          onPedido={(slug, skill, args) => { setPedido({ id: Date.now(), skill, cliente: slug, args }); setView({ name: 'agente', slug }); }} />}
        {/* La consola queda montada siempre: así no se pierden la sesión ni el WebSocket al cambiar de vista. */}
        <section hidden={view.name !== 'agente'}>
          <header className="page-head"><div><h2>Agente</h2><p className="muted small">Ejecutá un skill y seguí el trabajo en vivo</p></div></header>
          <Consola token={token} skills={skills} clientes={clientes || []} preCliente={view.name === 'agente' ? view.slug : undefined}
            visible={view.name === 'agente'} pedido={pedido} onCorriendo={setCorriendo} onPendientes={setEsperando} onAviso={setAviso} />
        </section>
        <Pie />
      </main>
    </div>
    </>
  );
}
