// Convierte un evento stream-json de Claude Code en entradas del historial que muestra el panel.
// Entradas: { k: 'user' | 'agent' | 'tool' | 'meta' | 'err', text }
export function entradasDe(d) {
  if (!d || typeof d !== 'object') return [];
  if (d.type === 'assistant') {
    return (d.message?.content || []).flatMap((b) => {
      if (b.type === 'text' && b.text?.trim()) return [{ k: 'agent', text: b.text }];
      if (b.type === 'tool_use') {
        const resumen = JSON.stringify(b.input || {}).slice(0, 140);
        return [{ k: 'tool', text: `${b.name} ${resumen}` }];
      }
      return [];
    });
  }
  if (d.type === 'result') {
    const authHint = d.is_error && /authenticate|OAuth|login/i.test(d.result || '')
      ? ' → Iniciá sesión de nuevo abriendo una terminal y ejecutando `claude` (luego /login).' : '';
    if (d.is_error) return [{ k: 'err', text: `Terminó con error: ${d.result || d.subtype}${authHint}` }];
    return [{ k: 'meta', text: `Listo · ${d.num_turns ?? '?'} pasos${d.total_cost_usd ? ` · US$ ${d.total_cost_usd.toFixed(3)}` : ''}` }];
  }
  return [];
}
