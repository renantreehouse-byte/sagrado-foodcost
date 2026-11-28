# Sagrado · Portal de gestión

- `/` Portal de gestión (cuadros por área e indicadores)
- `/foodcost/` Food Cost
- `/inventario/` Registro de Inventario

Todas usan el mismo inicio de sesión y los mismos perfiles de Supabase.

## Food Cost

Aplicación web de control de food cost para el restaurante Sagrado (Cusco).
Es un solo archivo `index.html`. Los datos se guardan en **Supabase** y el sitio se publica en **Render** como *Static Site*.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La aplicación completa |
| `supabase.sql` | Crea la tabla y las reglas de seguridad en Supabase |
| `README.md` | Esta guía |

## 1. Supabase: base de datos

1. Crea una cuenta en https://supabase.com y luego un proyecto nuevo (*New project*). Elige la región más cercana (por ejemplo, São Paulo) y guarda la contraseña de la base de datos.
2. Entra a **SQL Editor → New query**, pega todo el contenido de `supabase.sql` y presiona **Run**. Se crea la tabla `foodcost_datos` con Row Level Security activado.
3. Entra a **Authentication → Users → Add user → Create new user**. Crea un usuario por persona con su correo y contraseña, y marca *Auto Confirm User*.
4. En **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up* para que solo entren los usuarios que creaste.
5. En **Project Settings → API Keys**, copia la **Publishable key** (`sb_publishable_...`). Si solo ves claves *legacy*, presiona *Create new API keys*. Copia también la **Project URL** (`https://xxxx.supabase.co`).

> **Nunca** pongas la *secret key* ni la *service_role* en `index.html`. La clave publicable sí puede ir en el navegador, porque los datos quedan protegidos por las políticas RLS.

## 2. Configurar `index.html`

Abre `index.html` y completa el bloque del inicio:

```js
window.FOODCOST_CONFIG={
  supabaseUrl:'https://xxxx.supabase.co',
  supabaseKey:'sb_publishable_xxxxxxxx',
  restaurante:'sagrado'
};
```

Si dejas estos valores vacíos, la app funciona en *modo local* y guarda solo en el navegador.

## 3. GitHub: repositorio

1. Crea un repositorio nuevo en https://github.com (por ejemplo `sagrado-foodcost`).
2. Usa **Add file → Upload files** para subir `index.html`, `supabase.sql` y `README.md` a la raíz, y luego **Commit changes**.

## 4. Render: publicar

1. Entra a https://render.com con tu cuenta de GitHub.
2. Haz clic en **New → Static Site** y elige el repositorio.
3. Configura:
   - **Branch:** `main`
   - **Build Command:** déjalo vacío
   - **Publish Directory:** `.`
4. Presiona **Deploy Static Site**. En uno o dos minutos tendrás la URL `https://sagrado-foodcost.onrender.com`.
5. Cada cambio que subas a GitHub se publica automáticamente.

## 5. Ajuste final en Supabase

En **Authentication → URL Configuration**, coloca la URL de Render en **Site URL**. Esto hace que los correos de Supabase, como el de recuperar contraseña, apunten a tu app.

## Cómo se guardan los datos

- Hay una fila por restaurante (`restaurante = 'sagrado'`) y la columna `datos` (JSON) contiene insumos, recetas, ventas, inventario, configuración y marca.
- La app guarda automáticamente 0,8 segundos después del último cambio. El indicador del encabezado muestra el estado.
- Si dos personas editan al mismo tiempo, queda el último cambio guardado.
- `actualizado_por` y `actualizado_en` registran quién hizo el último cambio y cuándo.
