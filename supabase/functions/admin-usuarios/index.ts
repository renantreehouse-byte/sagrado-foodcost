// Edge Function: admin-usuarios
// Gestiona usuarios de Food Cost. Solo responde a un usuario con perfil "admin" activo.
// La clave secreta de Supabase vive solo aquí (servidor), nunca en el navegador.
import { createClient } from "npm:@supabase/supabase-js@2.110.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["admin", "editor", "lector"];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
  try {
    const keys = JSON.parse(raw);
    if (typeof keys === "string") return keys;
    if (Array.isArray(keys)) return keys[0]?.api_key ?? keys[0];
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return raw;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Método no permitido", 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. ¿Quién llama? Debe tener sesión iniciada…
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await admin.auth.getUser(jwt);
  const me = who?.user;
  if (!me) return fail("Sesión no válida. Vuelve a ingresar.", 401);

  // …y ser administrador activo.
  const { data: perfil } = await admin.from("perfiles").select("rol, activo").eq("id", me.id).maybeSingle();
  if (!perfil || perfil.rol !== "admin" || !perfil.activo) return fail("Solo el administrador puede gestionar usuarios.", 403);

  let b: Record<string, any>;
  try { b = await req.json(); } catch { return fail("Solicitud inválida"); }
  const propio = b.id === me.id;

  switch (b.accion) {
    case "listar": {
      const { data: lista, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (error) return fail(error.message, 500);
      const { data: perfiles } = await admin.from("perfiles").select("*");
      const usuarios = lista.users.map((u) => {
        const p = perfiles?.find((x) => x.id === u.id);
        return {
          id: u.id, email: u.email, nombre: p?.nombre ?? "", rol: p?.rol ?? "lector",
          activo: p?.activo ?? true, ultimo: u.last_sign_in_at ?? null, creado: u.created_at,
        };
      }).sort((a, b) => (a.rol === "admin" ? -1 : 0) - (b.rol === "admin" ? -1 : 0) || a.email!.localeCompare(b.email!));
      return json({ usuarios });
    }

    case "crear": {
      const email = String(b.email ?? "").trim().toLowerCase();
      const nombre = String(b.nombre ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Correo no válido.");
      if (String(b.password ?? "").length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");
      if (!ROLES.includes(b.rol)) return fail("Perfil no válido.");
      if (b.rol === "admin") return fail("Solo puede haber un administrador.");
      const { data, error } = await admin.auth.admin.createUser({
        email, password: b.password, email_confirm: true, user_metadata: { nombre },
      });
      if (error) return fail(/already/i.test(error.message) ? "Ya existe un usuario con ese correo." : error.message);
      await admin.from("perfiles").upsert({ id: data.user.id, email, nombre, rol: b.rol, activo: true });
      return json({ ok: true, id: data.user.id });
    }

    case "actualizar": {
      if (!b.id) return fail("Falta el usuario.");
      const cambios: Record<string, unknown> = {};
      if (typeof b.nombre === "string") cambios.nombre = b.nombre.trim();
      if (b.rol !== undefined) {
        if (propio) return fail("No puedes cambiar tu propio perfil de administrador.");
        if (!ROLES.includes(b.rol)) return fail("Perfil no válido.");
        if (b.rol === "admin") return fail("Solo puede haber un administrador.");
        cambios.rol = b.rol;
      }
      if (typeof b.activo === "boolean") {
        if (propio) return fail("No puedes desactivar tu propio usuario.");
        cambios.activo = b.activo;
        const { error } = await admin.auth.admin.updateUserById(b.id, { ban_duration: b.activo ? "none" : "876000h" });
        if (error) return fail(error.message, 500);
      }
      const { error } = await admin.from("perfiles").update(cambios).eq("id", b.id);
      if (error) return fail(error.message, 500);
      return json({ ok: true });
    }

    case "password": {
      if (!b.id) return fail("Falta el usuario.");
      if (String(b.password ?? "").length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");
      const { error } = await admin.auth.admin.updateUserById(b.id, { password: b.password });
      if (error) return fail(error.message, 500);
      return json({ ok: true });
    }

    case "eliminar": {
      if (!b.id) return fail("Falta el usuario.");
      if (propio) return fail("No puedes eliminar tu propio usuario.");
      const { error } = await admin.auth.admin.deleteUser(b.id);
      if (error) return fail(error.message, 500);
      return json({ ok: true });
    }

    default:
      return fail("Acción no reconocida.");
  }
});
