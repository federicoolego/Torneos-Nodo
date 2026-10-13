# Generador de Torneos · NODO

App web para armar las zonas y el playoff de cada categoría de un torneo, generar las imágenes
para WhatsApp y **cargar los resultados** (las posiciones de zona y los cruces se completan solos).

- Vite + React + TypeScript + Tailwind. Se publica en GitHub Pages.
- Datos en **Supabase**, tablas con prefijo `torneos_nodo_` (esquema en `supabase/torneos_nodo.sql`).

## Flujo

1. **Torneo:** nombre (incluye la categoría), fechas, inscripción, premio y formato por instancia.
2. **Parejas:** se pegan una por línea o separadas por `;` (`Juan Pérez / Luis Gómez; Juan Galeano / Marcos Francés`).
3. **Zonas:** sorteo aleatorio o por orden de carga, y después ajuste manual (mover de zona, cambiar la posición). Zonas de 3 o de 4.
4. **Horarios de zona:** día y hora de cada partido. "Completar automático" los reparte en turnos.
5. **Playoff:** "Armar automático" (1° de zona primero, después 2° y 3°, sin cruces de la misma zona) y ajuste manual de cada cruce ("1° Zona A vs 2° Zona D"). El horario es obligatorio en la primera ronda.
6. **Imágenes:** zonas (una o varias imágenes, según la cantidad) y playoff, con logo, nombre, fechas, inscripción y premio; el playoff se va completando con nombres y resultados.
7. **Partidos:** carga de resultados validados según el formato de cada instancia (mejor de 3, mejor de 3 con
   super tiebreak, americano a 7 o a 9 games), tablas de zona, avance del cuadro y campeón. Cronograma en PDF con los resultados.

El **botón verde flotante** (abajo a la derecha) genera las imágenes desde cualquier paso y las
comparte. En el celular abre el menú de compartir del sistema, donde se elige WhatsApp. En una
compu que no permite compartir archivos, las descarga para adjuntarlas a mano.

## Página pública y panel de organizadores

- `…/` → torneos publicados (para jugadores, sin login). `…/#/torneo/<id>` → un torneo (link para compartir).
- `…/#/admin` → panel de organizadores (login con usuario NODO).
- La página pública lee solo con las funciones `torneos_nodo_publicos()` y `torneos_nodo_publico(id)` (ver `supabase/torneos_nodo_publico.sql`): solo torneos publicados y sin datos internos.

## Base de datos y acceso

1. En el SQL Editor de Supabase corré `supabase/torneos_nodo.sql` (se puede volver a correr).
2. **Authentication → Users → Add user**: `nodo@generador.nodo.com.ar`, con contraseña y *Auto Confirm User*.
   En la app se entra con usuario `NODO` y esa contraseña.
3. Solo los emails de `torneos_nodo_usuarios` pueden leer y escribir (RLS), aunque haya otros usuarios en el proyecto.

## Publicar

1. Subí el contenido de esta carpeta (incluida `.github`) al repo `Torneos-Nodo`, rama `main`.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Environments → github-pages → Environment variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Cada push publica en `https://<usuario>.github.io/Torneos-Nodo/`.

Con dominio propio, cambiá en `.github/workflows/deploy.yml` la línea `BASE_PATH` por `BASE_PATH: /`.

## Local

```bash
npm install
# .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```
