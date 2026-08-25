# Suite de tests automatizados

Valida el comportamiento del código determinístico del sistema (hooks, scripts) y la
integridad estructural de la configuración (`skills`, `agents`, `.claude/`). No testea el
comportamiento del LLM en sí (eso se valida con los dry-runs documentados en cada
`clientes/*/test-fase*.md`) — testea las **redes de seguridad técnicas** que existen
justamente para no depender solo del criterio del modelo.

## Requisitos

```powershell
Install-Module -Name Pester -Scope CurrentUser -MinimumVersion 5.0
```

## Correr toda la suite

```powershell
./tests/Run-Tests.ps1
```

Exit code `0` si todo pasa, `1` si hay algún fallo (para usar en CI).

## Qué cubre cada archivo

| Archivo | Qué valida |
|---|---|
| `ValidarPublicacion.Tests.ps1` | El hook PreToolUse bloquea publicar/gastar sin `.plan.json` aprobado del cliente correcto, permite cuando sí existe, y **no se filtra entre clientes** (regresión de un bug real encontrado y corregido). |
| `RegistrarActividad.Tests.ps1` | El hook PostToolUse registra en el log del cliente correcto, ignora tools irrelevantes, y no pisa el log en llamadas sucesivas. |
| `ChecklistMarca.Tests.ps1` | Detecta violaciones de las restricciones del perfil (precios, promesas prohibidas) y no genera falsos positivos en texto limpio. |
| `EstructuraAgencia.Tests.ps1` | `.claude/` está completo y bien formado: `CLAUDE.md`, `settings.json` (JSON válido), `.env.example` sin secretos, cada `SKILL.md`/agente tiene el frontmatter mínimo requerido, y los `.ps1` parsean sin errores de sintaxis. |
| `PlanJsonSchema.Tests.ps1` | Todo `.plan.json` generado por `/crear-post` cumple el esquema que el resto del sistema espera (campos requeridos, tipos correctos, coherencia cliente↔carpeta). |

## Por qué esta separación (unitario vs. estructural)

Los **hooks y scripts** son código PowerShell determinístico: mismo input, mismo output —
se prestan a tests unitarios clásicos (Pester, arrange-act-assert).

Los **skills** (`SKILL.md`) son instrucciones en lenguaje natural para Claude, no código — no
tiene sentido "unit testearlos" de la misma forma. Lo que sí se puede y se hace acá es
validar su **forma** (frontmatter correcto, nombre coincide con la carpeta) automáticamente, y
su **comportamiento real** se valida con los dry-runs documentados manualmente en
`clientes/*/test-fase*.md`, que son la evidencia de que el LLM efectivamente sigue el
procedimiento descrito.
