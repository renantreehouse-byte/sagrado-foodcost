-- =====================================================================
-- Food Cost · Sagrado — perfiles de usuario y permisos por rol
-- Perfiles: admin (todo + usuarios), editor (edita datos), lector (solo ve)
-- =====================================================================

-- 1. Esquema privado para funciones auxiliares (no se expone en la API)
create schema if not exists private;
grant usage on schema private to authenticated;

-- 2. Tabla de perfiles: un registro por usuario de Supabase Auth
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  nombre    text,
  rol       text not null default 'lector' check (rol in ('admin','editor','lector')),
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
comment on table public.perfiles is 'Perfil y rol de cada usuario de Food Cost';

-- 3. Rol del usuario actual (solo si está activo)
create or replace function private.mi_rol()
returns text
language sql stable security definer set search_path = ''
as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;
revoke all on function private.mi_rol() from public, anon;
grant execute on function private.mi_rol() to authenticated;

-- 4. Crear perfil automáticamente cuando se crea un usuario (por defecto: lector)
create or replace function private.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists crear_perfil on auth.users;
create trigger crear_perfil after insert on auth.users
  for each row execute function private.crear_perfil();

-- 5. Seguridad de perfiles: cada uno ve el suyo; el administrador ve todos.
--    Crear, cambiar o borrar usuarios solo lo hace la función admin-usuarios.
alter table public.perfiles enable row level security;
drop policy if exists "Ver mi perfil o todos si soy admin" on public.perfiles;
create policy "Ver mi perfil o todos si soy admin" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.mi_rol()) = 'admin');
revoke all on public.perfiles from anon;
grant select on public.perfiles to authenticated;

-- 6. Datos de Food Cost: leen los usuarios activos; editan admin y editor
drop policy if exists "Usuarios autenticados leen"       on public.foodcost_datos;
drop policy if exists "Usuarios autenticados insertan"   on public.foodcost_datos;
drop policy if exists "Usuarios autenticados actualizan" on public.foodcost_datos;

create policy "Leen usuarios activos" on public.foodcost_datos
  for select to authenticated using ((select private.mi_rol()) is not null);
create policy "Insertan admin y editor" on public.foodcost_datos
  for insert to authenticated with check ((select private.mi_rol()) in ('admin','editor'));
create policy "Actualizan admin y editor" on public.foodcost_datos
  for update to authenticated
  using ((select private.mi_rol()) in ('admin','editor'))
  with check ((select private.mi_rol()) in ('admin','editor'));

-- 7. Perfiles de los usuarios que ya existen; Renan queda como único administrador
insert into public.perfiles (id, email, nombre, rol)
select id, email,
       case when email = 'renantreehouse@gmail.com' then 'Renan Neira' else split_part(email,'@',1) end,
       case when email = 'renantreehouse@gmail.com' then 'admin' else 'lector' end
from auth.users
on conflict (id) do update set rol = excluded.rol
  where public.perfiles.email = 'renantreehouse@gmail.com';
