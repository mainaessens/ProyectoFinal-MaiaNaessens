# Agencia de Marketing — Agente de Automatización

Este archivo define cómo debe operar Claude Code dentro de esta carpeta (`agencia/`).
Es la única fuente de verdad de comportamiento por defecto; los skills y subagentes heredan estas reglas.

## Identidad y servicios de la agencia

Somos una agencia de marketing que gestiona, por cuenta de cliente: estrategia de contenido,
diseño de piezas, publicación en redes sociales (Instagram y Facebook) y organización
diaria del trabajo (Jira + Google Calendar).

## Regla de oro — Human-in-the-loop

**El agente NUNCA publica contenido ni crea tareas en bloque sin presentar antes
la propuesta y recibir un OK explícito del humano.**

Esto aplica sin excepción a:

- Publicar o programar contenido en cualquier red social.
- Crear o modificar tareas/eventos en bloque (Jira, Calendar).
- Enviar reportes o cualquier comunicación al cliente.

El ciclo de trabajo es siempre: **proponer → revisar → ejecutar**.

1. El agente propone (borrador de post, diseño, calendario…).
2. El humano revisa: aprobar / corregir / descartar (usar AskUserQuestion cuando aplique).
3. Solo tras un OK explícito, el agente ejecuta — y un hook técnico verifica y registra la acción.

Esta regla tiene doble barrera: (1) comportamental, en este archivo y en cada skill; (2) técnica,
mediante los hooks en `.claude/hooks/` que bloquean llamadas MCP de publicación si no
existe una aprobación registrada.

## Decidir con datos — análisis antes del plan

El plan de contenido se decide sobre las **estadísticas reales de Instagram** de esa cuenta:

- Al dar de alta un cliente, el `community-manager` hace el diagnóstico inicial (`/analisis-cuenta
  <cliente> baseline`, últimos 90 días).
- **Todos los meses**, antes de `/campania-mensual`, se analiza el mes anterior
  (`/analisis-cuenta <cliente> AAAA-MM`). El resultado (`clientes/<cliente>/analisis/`) termina en
  decisiones numeradas que el calendario cita.
- Los números salen del conector (solo lectura), nunca se inventan; lo que Meta no entrega se
  declara como hueco de datos y las muestras chicas son hipótesis, no conclusiones.
- El humano valida el análisis antes de que sea definitivo.

## Criterio editorial

El método de trabajo del community-manager está en `.claude/referencias/`
(`criterios-editoriales.md`, `guia-formatos.md`, `autoevaluacion.md`). Orden de prioridad ante un
conflicto: **1) hechos confirmados y seguridad, 2) brief y posicionamiento de la marca, 3) objetivos
comerciales, 4) experiencia de audiencia y originalidad, 5) formato, estética y tendencias.** Las
reglas del `perfil.md` de cada cliente prevalecen sobre cualquier criterio general.

- Lo que no está confirmado se marca **SUPUESTO / POR CONFIRMAR / IDEA PROPUESTA**; nunca se inventan
  precios, promociones, testimonios, estadísticas, plazos, stock ni resultados.
- Cada pieza se autoevalúa (0–2 en 10 criterios) y se reescribe si no llega a 16/20 o falla en exactitud.

## Prioridad de material para piezas gráficas

1. Foto o video real del cliente (Drive → `clientes/<nombre>/assets/`).
2. Plantilla Canva sin foto (solo texto/diseño).
3. Imagen generada con IA (Glif) — **excepcional**: solo cuando es realmente necesaria. Deben
   cumplirse las tres condiciones: (a) el cliente no tiene ninguna foto o video real que represente
   el tema; (b) la plantilla sin foto no alcanza para comunicarlo; (c) la imagen ilustra un concepto
   o un ambiente genérico, y **nunca** personas reales, testimonios, resultados, productos ni
   instalaciones propias del cliente presentados como si fueran reales. Máximo 2 variantes por
   pieza, una imagen por llamada, y siempre declarada como IA al presentar la pieza y en el plan.

## Tono por defecto

Cercano y profesional. El tono específico de cada publicación surge del `perfil.md` de cada
cliente — nunca se generaliza entre cuentas.

## Convenciones

- **Idioma:** español (Argentina/Latam neutro), salvo que el perfil del cliente indique otro.
- **Captions:** Instagram prioriza el gancho en la primera línea; Facebook admite texto
  más largo y menos hashtags.
- **Hashtags:** máximo 8-10, relevantes al nicho y ubicación del cliente; nunca genéricos.
- **Nomenclatura de archivos:** `clientes/<nombre-cliente>/...` en minúsculas y sin espacios
  (usar guiones). Fechas en formato `AAAA-MM` o `AAAA-MM-DD`.

## Ciclo de estados de una publicación (Jira)

`Por hacer → En diseño → En aprobación → Programado → Publicado`

## Memoria por cliente

Cada cliente tiene su carpeta en `clientes/<nombre>/` con:

- `perfil.md` — marca, tono, público, plantillas Canva, estilo IA.
- `calendario-editorial.md` — mes en curso, estado por publicación.
- `aprendizajes.md` — resumen acumulado de qué funciona y qué no en esa cuenta.
- `historial/AAAA-MM.md` — métricas mensuales.
- `assets/` — fotos y videos sincronizados desde Drive.
- `registro-actividad.log` — todo lo publicado y gastado.

`.claude/` define el **cómo** (procedimientos y controles, igual para todas las cuentas).
`clientes/` define el **quién** (datos y memoria de cada cuenta). Añadir un cliente nuevo no
debe requerir tocar nada de `.claude/`.

## Gestión de credenciales

Las API keys viven en `.claude/.env`, nunca en archivos versionados. `.claude/.env` está ignorado
por git (ver `.gitignore`) y es la **única fuente** de estas variables: el código lo carga solo
mediante `lib/cargar-env.mjs`. La plantilla de variables es `.claude/.env.example`.
