---
name: nuevo-cliente
description: Da de alta un cliente nuevo en la agencia. Crea su carpeta en clientes/<nombre>/ con la estructura completa (perfil.md, assets/, historial/, registro de actividad) a partir de la plantilla. En esta versión (Fase 0) el perfil se completa a mano o con los datos que el usuario indique en el chat; desde la Fase 2 leerá brief y manual de marca directamente de Google Drive.
---

# /nuevo-cliente

Da de alta un cliente nuevo de la agencia.

## Uso

```
/nuevo-cliente <nombre-cliente> [url-drive-opcional]
```

- `<nombre-cliente>`: nombre corto, en minúsculas y sin espacios (usar guiones si hace falta).
  Ejemplo: `cafe-lunar`, `cedite`.
- `[url-drive-opcional]`: URL de la carpeta de Google Drive del cliente. En Fase 0 solo se anota
  en el perfil como pendiente de lectura automática (esa lectura llega en la Fase 2).

## Procedimiento

1. **Verificar que no exista ya** `clientes/<nombre-cliente>/`. Si existe, avisar y detenerse —
   no sobrescribir sin confirmación explícita.
2. **Crear la estructura** copiando `clientes/plantilla/`:
   ```
   clientes/<nombre-cliente>/
   ├── perfil.md
   ├── calendario-editorial.md
   ├── aprendizajes.md
   ├── historial/
   ├── assets/
   │   ├── fotos/
   │   └── videos/
   └── registro-actividad.log
   ```
3. **Completar `perfil.md` parcialmente**: nombre del cliente, y si se dio `url-drive`, anotarla
   en la sección "Identidad" con la nota `(pendiente de lectura automática — Fase 2)`.
4. **Preguntar al usuario** (no asumir) los datos mínimos que falten para un perfil útil: sector,
   público objetivo, tono, 2-3 pilares de contenido, y qué NO publicar. Usar AskUserQuestion o
   preguntas directas en el chat.
5. **Presentar el perfil resultante completo** antes de darlo por cerrado — el usuario puede
   corregir cualquier campo.
6. **Crear `registro-actividad.log`** vacío con una primera línea de alta:
   `[<fecha>] Cliente <nombre-cliente> dado de alta.`
7. Confirmar al usuario la ruta creada y sugerir el siguiente paso (`/plan-del-dia` una vez
   exista la Fase 3, o seguir completando el perfil).

## Reglas

- Nunca crear tareas en Jira ni eventos en Calendar desde este skill en su versión de Fase 0
  (eso llega con Fase 3). Esta versión es solo estructura + perfil local.
- Nunca sobrescribir un cliente existente sin confirmación explícita del usuario.
- El perfil generado debe quedar coherente con el formato de `clientes/plantilla/perfil.md`.
