// Lógica de una conexión WebSocket del panel: una ejecución a la vez por conexión.
// Está separada de index.js para poder probarla sin red ni procesos reales.
//
// Reglas:
//  - Una ejecución en curso solo termina por: su propio fin, un mensaje `cancel` o el cierre de la conexión.
//  - Cualquier otro mensaje (inválido, desconocido, o un `run` mientras hay uno activo) NO la afecta.
//  - Si la conexión se cierra mientras se prepara el prompt, no se lanza nada (evita procesos huérfanos).
export function manejarConexion({ send, buildPrompt, startRun }) {
  let ocupado = false;   // hay una ejecución en curso (o preparándose)
  let run = null;        // { kill() } de la ejecución en curso
  let cerrada = false;

  return {
    get ocupado() { return ocupado; },

    async onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'cancel') { run?.kill(); return; }
      if (msg.type !== 'run') return;
      if (ocupado) return send({ type: 'error', text: 'Ya hay una ejecución en curso.' });

      ocupado = true; // se reserva antes de cualquier await: dos `run` seguidos no pueden pisarse
      try {
        const prompt = await buildPrompt(msg);
        if (cerrada) { ocupado = false; return; }
        send({ type: 'start', prompt });
        let termino = false;
        const r = startRun({
          prompt,
          sessionId: msg.sessionId,
          emit: (ev) => {
            send(ev);
            if (ev.type === 'done') { termino = true; run = null; ocupado = false; }
          },
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
