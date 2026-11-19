# Editor de video — Moviola

Editor de video local de la agencia. Toma el video en bruto de un cliente (reel o historia), lo corta,
lo subtitula palabra a palabra, le agrega títulos con la marca del cliente y exporta un video vertical
9:16 **solo después de que el humano aprueba el plan escena por escena**. Todo corre en la computadora:
el video no se sube a ningún servicio.

El método de 5 pasos (carpetas → herramientas → estilo → bruto → plan aprobable) se basa en la guía
pública «tu editor de video» de @matizby.yuyi. No se usan las reglas ni los efectos del editor de pago
de esa autora: el método de edición de este proyecto es propio (`.claude/referencias/guia-edicion-video.md`).

## Qué necesitás

| Requisito | Para qué | Cómo se instala (Windows) |
|---|---|---|
| Node.js 20 o más | Moviola y el panel Postagent | `winget install OpenJS.NodeJS.LTS` |
| FFmpeg (con `ffprobe`) | cortar, unir, quemar subtítulos, normalizar audio | `winget install Gyan.FFmpeg` |
| Python 3.9 a 3.12 | Whisper | `winget install Python.Python.3.12` |
| faster-whisper y `av` < 19 | transcripción local con tiempos por palabra | `python -m pip install -r herramientas/moviola/requirements.txt` |
| yt-dlp *(opcional)* | bajar reels de referencia para estudiar su estilo | `winget install yt-dlp.yt-dlp` |
| Plugin HyperFrames **(obligatorio para `/crear-video`)** | videos sin material de base (HTML/CSS → MP4) y motion graphics | `claude plugin install hyperframes@claude-plugins-official` |
| Node.js 22 o más y Chrome o Edge | los exige HyperFrames para renderizar (con Node 20, `/editar-video` anda pero `/crear-video` no) | `winget install OpenJS.NodeJS.LTS` · `winget install Google.Chrome` |

**Primer uso de HyperFrames:** la herramienta se baja sola con `npx` la primera vez (unos minutos, necesita internet). Para comprobar que quedó lista: `npx hyperframes doctor`; deben salir en verde Node, FFmpeg y Chrome. Whisper, TTS, música local y Docker que marca como faltantes son opcionales y no se necesitan para `/crear-video`. Renderizar consume memoria: conviene cerrar otras aplicaciones (el diagnóstico avisa si hay menos de ~2 GB libres).
| Claude Code con sesión iniciada | el agente que usa el skill `/editar-video` | ver docs de Claude Code |

En macOS el equivalente es `brew install node ffmpeg python yt-dlp`. Las instalaciones con `winget`
agregan las herramientas al `PATH` solo para terminales nuevas: Moviola también las busca en la carpeta
de paquetes de winget, así que funciona sin reiniciar.

**Comprobar el equipo:** `node herramientas/moviola/moviola.mjs doctor` (devuelve `listo_para_editar:true`
cuando no falta nada). La primera transcripción descarga el modelo de Whisper (`small` ≈ 460 MB).

## Cómo se usa

1. Dejá el video en bruto en `clientes/<cliente>/assets/videos/` (tal cual sale del celular).
2. En Claude Code, o desde la sección **Agente** de Postagent: `/editar-video <cliente> <archivo> [instrucciones]`.
   Contale de qué va, qué palabra resaltar y qué no querés («sin emojis», «sin zoom»).
3. El agente prepara la **hoja de marca** del cliente (`hoja-de-marca.json`: colores, tipografías,
   qué nunca hacer), transcribe, detecta silencios y escribe el **plan escena por escena**.
4. Mira su propio preview como crítico y corrige lo que falle. Después te muestra el plan: aprobás cada
   escena o dejás notas concretas («escena 3: el subtítulo más arriba, que me tapa la boca»). Cada ronda
   genera una versión nueva del plan.
5. Con todas las escenas aprobadas, exporta a `clientes/<cliente>/assets/terminados/<slug>-v<N>.mp4`.
6. El archivo terminado es el `video` de `/crear-reel` o el recurso de `/crear-historias`.

## Qué hace y qué no

| Hace | No hace todavía |
|---|---|
| Corta silencios y tomas repetidas, vertical 1080×1920 | Mezclar efectos de sonido (queda como nota en el plan) |
| Subtítulos palabra a palabra, palabras clave en el color de resalte | Zoom, 3D, texto detrás de la persona, transiciones elaboradas |
| Títulos con entrada animada, dentro de las zonas seguras de Instagram | Calcar automáticamente el ritmo de un video de referencia |
| Audio normalizado a −14 LUFS | Variantes automáticas con otros ganchos |
| Plan aprobable con barrera técnica de exportación | Publicar: eso lo hace `/crear-reel` con su propio OK |

Para motion graphics avanzados está el plugin **HyperFrames** (`/hyperframes`), a pedido y pasando por el
mismo plan y la misma aprobación. Está instalado pero no se probó todavía con un video real.

## Comandos de la herramienta

`node herramientas/moviola/moviola.mjs <comando>` (salida siempre en JSON):

| Comando | Qué hace |
|---|---|
| `doctor` | verifica FFmpeg, Python, faster-whisper, yt-dlp y Node |
| `preparar <cliente>` | crea `assets/{referencias,edicion,terminados}` y la hoja de marca en borrador |
| `sondear <cliente> <ruta>` | duración, resolución, audio y fps de un video |
| `transcribir <cliente> <ruta> [--modelo small] [--idioma es]` | transcripción con tiempos por palabra |
| `silencios <cliente> <ruta>` | tramos que se conservan al cortar silencios |
| `validar <cliente> <plan>` | valida el plan y dice si es exportable |
| `renderizar <cliente> <plan> [--preview]` | `--preview` baja resolución para revisar; sin él exporta el final (**solo con plan aprobado**) |
| `fotograma <cliente> <ruta> <segundo>` | extrae una imagen para la revisión crítica |
| `bajar-referencia <cliente> <url>` | baja un video de Instagram, TikTok o YouTube **solo para estudiar su estilo** |

## Barreras

- **No se exporta el video final sin aprobación total**: `aprobado_total:true` y todas las escenas en
  `aprobada`. La herramienta se niega aunque el agente lo intente.
- **El bruto no se toca**: todo se trabaja en `assets/edicion/` y la salida va a `assets/terminados/`.
- Las rutas se resuelven siempre dentro de `clientes/<cliente>/assets/`; los nombres se validan contra
  recorridos de directorio; no se ejecuta ningún comando por shell.
- El texto de la transcripción se neutraliza antes de generar los subtítulos, para que no pueda inyectar
  instrucciones en el formato de subtítulos (ASS).
- Todo corre localmente. Los videos de referencia ajenos se usan solo para estudiar estilo y ritmo; nunca
  se republican.

## Estado de verificación

- **Pruebas automatizadas:** 14 pruebas de Node (cortes, subtítulos, plan, argumentos de FFmpeg, barrera de
  exportación y confinamiento de rutas), que no requieren FFmpeg.
- **Prueba de punta a punta (6/11/2026)** con un clip sintético de 14 s (video de prueba y voz de síntesis):
  sondeo, detección de silencios, transcripción con Whisper (19 palabras), preview, bloqueo del export sin
  aprobación y export final de 8,2 s en 1080×1920 con audio, con la línea de auditoría correspondiente.
- **Sin verificar:** videos reales de un cliente, tipografías de pago de las marcas, HyperFrames y la mezcla
  de sonido.

## Videos sin material de base (`/crear-video`)

Cuando no hay video filmado, la idea se describe en palabras (desde Postagent: pestaña Videos del cliente, bloque «Video sin material de base») y el agente arma el video como una composición HTML/CSS con el kit de marca del cliente y, si se quiere, sus fotos reales (`assets/fotos/`, `assets/identidad/`). Se renderiza con HyperFrames (plugin) a `assets/terminados/<slug>-vN.mp4`.

- Usa el mismo ciclo que `/editar-video`: plan escena por escena en `assets/edicion/<slug>.vN.plan.json` (con `"tipo": "html"`), versiones que no se pisan y exportación solo con aprobación total.
- La composición de cada versión vive en `assets/edicion/<slug>.vN/`. Las imágenes originales se copian, nunca se modifican.
- Si HyperFrames no está instalado, el agente lo indica y pide permiso antes de instalar nada.
