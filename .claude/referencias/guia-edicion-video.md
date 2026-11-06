# Guía de edición de video (Moviola)

Criterios que usa el agente `editor-video` para planificar, revisar y exportar. Complementa a
`guia-formatos.md` (qué cuenta cada reel) con el **cómo se edita**. Es una guía, no una plantilla:
el `perfil.md` y la `hoja-de-marca.json` del cliente mandan.

## Antes de tocar el video

1. **Entender qué se quiere lograr**: objetivo, público y KPI de la pieza (ver la ficha de
   `/crear-reel`). Editar sin saber qué tiene que hacer el video produce algo prolijo pero inútil.
2. **Leer la transcripción completa**, no solo mirar el video. Las decisiones de corte salen de lo
   que se dice.
3. **Nunca modificar el bruto**: vive en `assets/videos/` y no se toca. Todo se hace sobre copias
   de trabajo en `assets/edicion/` y la salida en `assets/terminados/`.

## Cortes y ritmo

- **La mejor toma de cada frase**: si la persona repitió una frase, se conserva la **última toma
  buena** (la que mejor suena), no la primera. Se descartan muletillas largas, ruidos y arranques
  en falso.
- **Silencios**: se cortan los mayores a ~0,45 s dejando ~0,12 s de margen a cada lado para que la
  voz no quede "mordida". Una pausa dramática intencional se conserva y se anota en el plan.
- **Hablar desde el primer segundo**: el video arranca con la frase gancho, sin introducción ni
  «hola, soy…».
- **Una sorpresa cada 5–15 s**: un cambio de plano, un título nuevo, un dato, un giro. Si pasan más
  de 15 s sin nada nuevo, el plan lo marca como riesgo de abandono.
- **Duración**: 15–40 s por defecto (ver `guia-formatos.md`). Instagram limita los reels a 90 s.
- **Variedad**: no repetir la misma estructura de título ni el mismo tipo de corte que los 3
  últimos reels del cliente.

## Texto en pantalla

- **Título arriba que refuerza el gancho** en los primeros 3 s: corto (≤ 6 palabras), legible sin
  sonido. No repetir literalmente lo que dice la voz: sumarle tensión o contexto.
- **Subtítulos palabra a palabra**, en grupos de 2–3 palabras, con la palabra que se dice
  resaltada y las **palabras clave** de la pieza siempre en el color de resalte. Fieles a lo que se
  dice (se corrigen errores de la transcripción antes de exportar).
- **Zonas seguras de Instagram**: la interfaz tapa ~12 % arriba y ~25 % abajo. Nada importante
  (título, subtítulo, cara) debajo de ese 25 % ni pegado al borde superior.
- **Contraste y tamaño**: legible en un celular al sol; contorno grueso; sin más de dos
  tipografías (títulos y subtítulos, según la hoja de marca).
- Los subtítulos **no tapan la boca ni la cara**; si lo hacen, se suben o se baja el título.

## Audio

- Voz clara por encima de todo; se normaliza a **−14 LUFS** (referencia de Instagram).
- Un sonido por acción (golpe, whoosh, tecleo) solo si aporta; música baja, que no compita con la
  voz. *(El mezclador de efectos de sonido todavía no está en Moviola: se anota en el plan y se
  resuelve con `/hyperframes` + `media-use` si el usuario lo pide.)*

## Encuadre

- Salida **vertical 9:16, 1080×1920**. Si el bruto es horizontal, se recorta al centro (se pierde
  lo de los costados): avisar si hay alguien o algo importante fuera del centro.
- Material real del cliente primero; nada de stock genérico ni video generado con IA presentado
  como real (ver `CLAUDE.md`).

## Revisión crítica (antes de mostrar al humano)

El agente mira su propio resultado como un crítico: extrae fotogramas de los momentos clave
(`fotograma`) y comprueba:

- ¿El primer segundo engancha y se entiende sin sonido?
- ¿Algún texto se corta, se superpone o cae en una zona no segura?
- ¿Los subtítulos coinciden con lo que se dice y no tapan la cara?
- ¿Hay más de 15 s sin novedad? ¿Quedó algún silencio o muletilla?
- ¿Cumple las reglas del `perfil.md` (qué NO decir, tono) y de la hoja de marca (`nunca`)?
- ¿La duración sirve al objetivo?

Lo que no pasa se corrige **antes** de presentarlo. Se presenta con los hallazgos abiertos, sin
elogios de cortesía.

## Plan escena por escena y aprobación

- El plan se muestra **escena a escena**: tiempo en el bruto → tiempo en el video final, qué se
  dice, título, animación, nota de sonido, y por qué esa escena existe.
- El humano **aprueba cada escena o deja notas** concretas («escena 3: el subtítulo más arriba, que
  me tapa la boca»). Un «no me gusta» sin más no alcanza: se le pide escena, qué cambiar y cómo.
- Cada ronda de cambios genera una **versión nueva** del plan (`v2`, `v3`…); no se edita en
  silencio una versión ya revisada.
- **Sin `aprobado_total` y todas las escenas aprobadas, no se exporta** el video final (lo exige la
  herramienta). Los `--preview` sí se pueden generar siempre para revisar.

## Aprendizaje

Cada corrección del humano que sea una preferencia (no un arreglo puntual) se guarda en la
`hoja-de-marca.json` del cliente (`notas` o `nunca`) para aplicarla de entrada en el siguiente
video.

## Referencias de otros videos

- Se pueden bajar **solo para estudiar** estilo, ritmo y estructura (`bajar-referencia`). Se
  documenta qué mecanismo funciona y cómo se transforma para la marca, sin calcar el guion, el
  diseño ni la personalidad ajena (ver *Tendencias* en `criterios-editoriales.md`).
- Nunca se republica ni se reutiliza material ajeno.
