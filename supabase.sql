-- =====================================================================
-- Food Cost · Sagrado — estructura de base de datos en Supabase
-- Ejecutar una sola vez en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Tabla: un registro por restaurante con todos sus datos
--    (insumos, recetas, ventas, inventario, configuración y marca) en JSON.
create table if not exists public.foodcost_datos (
  restaurante     text primary key,
  datos           jsonb not null,
  actualizado_por uuid default auth.uid() references auth.users(id),
  actualizado_en  timestamptz not null default now()
);

comment on table public.foodcost_datos is 'Estado de la app Food Cost por restaurante';

-- 2. Registrar quién y cuándo hizo el último cambio
create or replace function public.foodcost_marcar_cambio()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en  := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists foodcost_marcar_cambio on public.foodcost_datos;
create trigger foodcost_marcar_cambio
  before insert or update on public.foodcost_datos
  for each row execute function public.foodcost_marcar_cambio();

-- 3. Seguridad: solo usuarios que iniciaron sesión pueden leer y escribir
alter table public.foodcost_datos enable row level security;

drop policy if exists "Usuarios autenticados leen"       on public.foodcost_datos;
drop policy if exists "Usuarios autenticados insertan"   on public.foodcost_datos;
drop policy if exists "Usuarios autenticados actualizan" on public.foodcost_datos;

create policy "Usuarios autenticados leen"
  on public.foodcost_datos for select
  to authenticated using (true);

create policy "Usuarios autenticados insertan"
  on public.foodcost_datos for insert
  to authenticated with check (true);

create policy "Usuarios autenticados actualizan"
  on public.foodcost_datos for update
  to authenticated using (true) with check (true);

-- 4. Permisos de la API (el rol anónimo no recibe ninguno)
revoke all on public.foodcost_datos from anon;
grant select, insert, update on public.foodcost_datos to authenticated;
