// Lógica de una conexión WebSocket del panel: una ejecución a la vez por conexión.
// Está separada de index.js para poder probarla sin red ni procesos reales.
//
// Reglas:
//  - Una ejecución en curso solo termina por: su propio fin, un mensaje `cancel` o el cierre de la conexión.
//  - Cualquier otro mensaje (inválido, desconocido, o un `run` mientras hay uno activo) NO la afecta.
//  - Si la conexión se cierra mientras se prepara el prompt, no se lanza nada (evita procesos huérfanos).
//  - Los pedidos del agente (preguntas con opciones y permisos) llegan como `solicitud` y se contestan con `responder`.
//  - El historial de cada sesión se guarda en el almacén, para poder abrirla y continuarla después (--resume).
//
// Eventos hacia el panel: start, entradas, sesion, solicitud, solicitud_resuelta, aviso, error, done.
import { entradasDe } from './entradas.js';

export function manejarConexion({ send, buildPrompt, startRun, almacen = null }) {
  let ocupado = false;   // hay una ejecución en curso (o preparándose)
  let run = null;        // { kill(), responder() } de la ejecución en curso
  let cerrada = false;
  let reg = null;        // registro de la sesión en curso: { id, cliente, skill, titulo, creada, entradas }
  let cola = Promise.resolve(); // escrituras al almacén, en orden

  const guardar = () => {
    if (!almacen || !reg?.id) return;
    const copia = { ...reg, entradas: [...reg.entradas] };
    cola = cola.then(() => almacen.guardar(copia)).catch(() => {});
  };
  const agregar = (es) => {
    if (!es.length) return;
    reg.entradas.push(...es);
    send({ type: 'entradas', entradas: es });
    guardar();
  };

  const onEvento = (ev) => {
    switch (ev.type) {
      case 'claude': {
        const id = ev.data?.session_id;
        if (id && id !== reg.id) { reg.id = id; send({ type: 'sesion', id }); }
        // total_cost_usd es ACUMULADO de la sesión (también al retomarla con --resume): se toma el último valor, no se suma.
        if (ev.data?.type === 'result' && Number.isFinite(ev.data.total_cost_usd)) {
          reg.costo = ev.data.total_cost_usd;
          send({ type: 'costo', total: reg.costo });
        }
        agregar(entradasDe(ev.data));
        break;
      }
      case 'stdout': agregar([{ k: 'meta', text: ev.text }]); break;
      case 'stderr': agregar([{ k: 'err', text: ev.text }]); break;
      case 'solicitud': send(ev); break;
      case 'solicitud_resuelta':
        send(ev);
        if (ev.resumen) agregar([{ k: 'user', text: ev.resumen }]);
        break;
      case 'error':
        send(ev);
        break;
      case 'done':
        agregar([{ k: 'meta', text: `Proceso finalizado (código ${ev.code})` }]);
        send({ type: 'done', code: ev.code });
        run = null;
        ocupado = false;
        break;
      default: break;
    }
  };

  return {
    get ocupado() { return ocupado; },
    flush: () => cola, // para las pruebas: espera a que terminen las escrituras pendientes

    async onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'cancel') { run?.kill(); return; }

      if (msg.type === 'responder') {
        if (!run) return send({ type: 'aviso', text: 'No hay una ejecución en curso.' });
        try { run.responder(msg.id, msg.decision); } catch (e) { send({ type: 'aviso', text: e.message }); }
        return;
      }

      if (msg.type !== 'run') return;
      if (ocupado) return send({ type: 'error', text: 'Ya hay una ejecución en curso.' });

      ocupado = true; // se reserva antes de cualquier await: dos `run` seguidos no pueden pisarse
      try {
        const prompt = await buildPrompt(msg);

        // Continuar una sesión: solo si está guardada (el id no viene de texto libre del navegador).
        let previa = null;
        if (msg.sessionId) {
          if (almacen) {
            previa = await almacen.leer(msg.sessionId);
            if (!previa) throw new Error('Esa sesión ya no está guardada: iniciá una nueva.');
          }
        }
        if (cerrada) { ocupado = false; return; }

        const modelo = typeof msg.modelo === 'string' ? msg.modelo : (previa?.modelo || '');
        reg = previa
          ? { id: previa.id, cliente: previa.cliente || '', skill: previa.skill || '', modelo, costo: Number(previa.costo) || 0, titulo: previa.titulo || '', creada: previa.creada || Date.now(), entradas: [...(previa.entradas || [])] }
          : { id: null, cliente: typeof msg.cliente === 'string' ? msg.cliente : '', skill: typeof msg.skill === 'string' ? msg.skill : '', modelo, costo: 0, titulo: '', creada: Date.now(), entradas: [] };
        if (!reg.titulo) reg.titulo = prompt.split('\n')[0].slice(0, 80);

        send({ type: 'start', prompt });
        agregar([{ k: 'user', text: prompt }]);
        let termino = false;
        const r = startRun({
          prompt,
          sessionId: msg.sessionId,
          modelo: msg.modelo, // se valida contra la lista permitida dentro de startRun
          emit: (ev) => { onEvento(ev); if (ev.type === 'done') termino = true; },
        });
        if (!termino) run = r; // si ya terminó, no queda una referencia vieja
      } catch (e) {
        ocupado = false;
        run = null;
        send({ type: 'error', text: e.message });
      }
    },

    // Cerrar la conexión (cerrar o recargar la pestaña) cancela la ejecución en curso.
    onClose() {
      cerrada = true;
      run?.kill();
      run = null;
      ocupado = false;
    },
  };
}
