create extension if not exists "uuid-ossp";

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'juandiegocortesgonzalez07@gmail.com'
$$;

-- PRODUCTS
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4()
);

alter table public.products
  add column if not exists name text,
  add column if not exists price numeric(10, 2),
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists created_at timestamptz default now();

update public.products
set
  name = coalesce(nullif(trim(name), ''), 'Producto sin nombre'),
  price = case
    when price is null or price < 0 then 0
    else price
  end,
  description = nullif(trim(description), ''),
  image_url = nullif(trim(image_url), ''),
  created_at = coalesce(created_at, now())
where
  name is null
  or btrim(name) = ''
  or price is null
  or price < 0
  or created_at is null
  or description is distinct from nullif(trim(description), '')
  or image_url is distinct from nullif(trim(image_url), '');

alter table public.products
  alter column name set not null,
  alter column price set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_price_nonnegative'
  ) then
    alter table public.products
      add constraint products_price_nonnegative check (price >= 0);
  end if;
end $$;

alter table public.products enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "Public insert products" on public.products;
drop policy if exists "Admin insert products" on public.products;
create policy "Admin insert products"
on public.products
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update products" on public.products;
drop policy if exists "Admin update products" on public.products;
create policy "Admin update products"
on public.products
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public delete products" on public.products;
drop policy if exists "Admin delete products" on public.products;
create policy "Admin delete products"
on public.products
for delete
to authenticated
using (public.is_admin_user());

-- SERVICES
create table if not exists public.services (
  id uuid primary key default uuid_generate_v4()
);

alter table public.services
  add column if not exists category text,
  add column if not exists badge text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists duration_minutes integer,
  add column if not exists price numeric(10, 2),
  add column if not exists created_at timestamptz default now();

update public.services
set
  category = coalesce(nullif(trim(category), ''), 'General'),
  badge = nullif(trim(badge), ''),
  name = coalesce(nullif(trim(name), ''), 'Servicio sin nombre'),
  description = nullif(trim(description), ''),
  duration_minutes = case
    when duration_minutes is null or duration_minutes <= 0 then 30
    else duration_minutes
  end,
  price = case
    when price is null or price < 0 then 0
    else price
  end,
  created_at = coalesce(created_at, now())
where
  category is null
  or btrim(category) = ''
  or badge is distinct from nullif(trim(badge), '')
  or name is null
  or btrim(name) = ''
  or description is distinct from nullif(trim(description), '')
  or duration_minutes is null
  or duration_minutes <= 0
  or price is null
  or price < 0
  or created_at is null;

alter table public.services
  alter column category set not null,
  alter column name set not null,
  alter column duration_minutes set not null,
  alter column price set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_duration_minutes_positive'
  ) then
    alter table public.services
      add constraint services_duration_minutes_positive check (duration_minutes > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_price_nonnegative'
  ) then
    alter table public.services
      add constraint services_price_nonnegative check (price >= 0);
  end if;
end $$;

alter table public.services enable row level security;

drop policy if exists "Public read services" on public.services;
create policy "Public read services"
on public.services
for select
to anon, authenticated
using (true);

drop policy if exists "Public insert services" on public.services;
drop policy if exists "Admin insert services" on public.services;
create policy "Admin insert services"
on public.services
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update services" on public.services;
drop policy if exists "Admin update services" on public.services;
create policy "Admin update services"
on public.services
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public delete services" on public.services;
drop policy if exists "Admin delete services" on public.services;
create policy "Admin delete services"
on public.services
for delete
to authenticated
using (public.is_admin_user());

-- CASH MOVEMENTS
create table if not exists public.cash_movements (
  id uuid primary key default uuid_generate_v4()
);

alter table public.cash_movements
  add column if not exists type text,
  add column if not exists category text,
  add column if not exists concept text,
  add column if not exists amount numeric(10, 2),
  add column if not exists movement_date date,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

update public.cash_movements
set
  type = case
    when type in ('income', 'expense') then type
    else 'income'
  end,
  category = coalesce(nullif(trim(category), ''), 'General'),
  concept = coalesce(nullif(trim(concept), ''), 'Movimiento sin concepto'),
  amount = case
    when amount is null or amount < 0 then 0
    else amount
  end,
  notes = nullif(trim(notes), ''),
  movement_date = coalesce(movement_date, current_date),
  created_at = coalesce(created_at, now())
where
  type is null
  or type not in ('income', 'expense')
  or category is null
  or btrim(category) = ''
  or concept is null
  or btrim(concept) = ''
  or amount is null
  or amount < 0
  or notes is distinct from nullif(trim(notes), '')
  or movement_date is null
  or created_at is null;

alter table public.cash_movements
  alter column type set not null,
  alter column category set not null,
  alter column concept set not null,
  alter column amount set not null,
  alter column movement_date set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_type_valid'
  ) then
    alter table public.cash_movements
      add constraint cash_movements_type_valid check (type in ('income', 'expense'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_amount_nonnegative'
  ) then
    alter table public.cash_movements
      add constraint cash_movements_amount_nonnegative check (amount >= 0);
  end if;
end $$;

alter table public.cash_movements enable row level security;

drop policy if exists "Public read cash movements" on public.cash_movements;
drop policy if exists "Admin read cash movements" on public.cash_movements;
create policy "Admin read cash movements"
on public.cash_movements
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Public insert cash movements" on public.cash_movements;
drop policy if exists "Admin insert cash movements" on public.cash_movements;
create policy "Admin insert cash movements"
on public.cash_movements
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update cash movements" on public.cash_movements;
drop policy if exists "Admin update cash movements" on public.cash_movements;
create policy "Admin update cash movements"
on public.cash_movements
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public delete cash movements" on public.cash_movements;
drop policy if exists "Admin delete cash movements" on public.cash_movements;
create policy "Admin delete cash movements"
on public.cash_movements
for delete
to authenticated
using (public.is_admin_user());

-- INVENTORY ITEMS
create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4()
);

alter table public.inventory_items
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists unit text,
  add column if not exists current_stock numeric(10, 2) default 0,
  add column if not exists min_stock numeric(10, 2) default 0,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

update public.inventory_items
set
  name = coalesce(nullif(trim(name), ''), 'Item sin nombre'),
  category = coalesce(nullif(trim(category), ''), 'General'),
  unit = coalesce(nullif(trim(unit), ''), 'unidades'),
  current_stock = case
    when current_stock is null or current_stock < 0 then 0
    else current_stock
  end,
  min_stock = case
    when min_stock is null or min_stock < 0 then 0
    else min_stock
  end,
  notes = nullif(trim(notes), ''),
  created_at = coalesce(created_at, now())
where
  name is null
  or btrim(name) = ''
  or category is null
  or btrim(category) = ''
  or unit is null
  or btrim(unit) = ''
  or current_stock is null
  or current_stock < 0
  or min_stock is null
  or min_stock < 0
  or notes is distinct from nullif(trim(notes), '')
  or created_at is null;

alter table public.inventory_items
  alter column name set not null,
  alter column category set not null,
  alter column unit set not null,
  alter column current_stock set not null,
  alter column min_stock set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_current_stock_nonnegative'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_current_stock_nonnegative check (current_stock >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_min_stock_nonnegative'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_min_stock_nonnegative check (min_stock >= 0);
  end if;
end $$;

alter table public.inventory_items enable row level security;

drop policy if exists "Public read inventory items" on public.inventory_items;
drop policy if exists "Admin read inventory items" on public.inventory_items;
create policy "Admin read inventory items"
on public.inventory_items
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Public insert inventory items" on public.inventory_items;
drop policy if exists "Admin insert inventory items" on public.inventory_items;
create policy "Admin insert inventory items"
on public.inventory_items
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update inventory items" on public.inventory_items;
drop policy if exists "Admin update inventory items" on public.inventory_items;
create policy "Admin update inventory items"
on public.inventory_items
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

-- INVENTORY MOVEMENTS
create table if not exists public.inventory_movements (
  id uuid primary key default uuid_generate_v4()
);

alter table public.inventory_movements
  add column if not exists inventory_item_id uuid,
  add column if not exists movement_type text,
  add column if not exists quantity numeric(10, 2),
  add column if not exists reason text,
  add column if not exists reference_label text,
  add column if not exists notes text,
  add column if not exists movement_date date default current_date,
  add column if not exists created_at timestamptz default now();

update public.inventory_movements
set
  movement_type = case
    when movement_type in ('entry', 'exit') then movement_type
    else 'entry'
  end,
  quantity = case
    when quantity is null or quantity <= 0 then 1
    else quantity
  end,
  reason = coalesce(nullif(trim(reason), ''), 'Movimiento de inventario'),
  reference_label = nullif(trim(reference_label), ''),
  notes = nullif(trim(notes), ''),
  movement_date = coalesce(movement_date, current_date),
  created_at = coalesce(created_at, now())
where
  movement_type is null
  or movement_type not in ('entry', 'exit')
  or quantity is null
  or quantity <= 0
  or reason is null
  or btrim(reason) = ''
  or movement_date is null
  or created_at is null
  or reference_label is distinct from nullif(trim(reference_label), '')
  or notes is distinct from nullif(trim(notes), '');

alter table public.inventory_movements
  alter column movement_type set not null,
  alter column quantity set not null,
  alter column reason set not null,
  alter column movement_date set not null,
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from public.inventory_movements im
    left join public.inventory_items ii on ii.id = im.inventory_item_id
    where im.inventory_item_id is null or ii.id is null
  ) then
    alter table public.inventory_movements
      alter column inventory_item_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_type_valid'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_type_valid check (movement_type in ('entry', 'exit'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_quantity_positive'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_quantity_positive check (quantity > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_inventory_item_id_fkey'
  )
  and not exists (
    select 1
    from public.inventory_movements im
    left join public.inventory_items ii on ii.id = im.inventory_item_id
    where im.inventory_item_id is null or ii.id is null
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_inventory_item_id_fkey
      foreign key (inventory_item_id) references public.inventory_items (id);
  end if;
end $$;

create or replace function public.apply_inventory_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock_value numeric(10, 2);
  adjusted_stock numeric(10, 2);
begin
  if tg_op = 'INSERT' then
    select current_stock
    into current_stock_value
    from public.inventory_items
    where id = new.inventory_item_id
    for update;

    if current_stock_value is null then
      raise exception 'El item de inventario seleccionado no existe.';
    end if;

    adjusted_stock := case
      when new.movement_type = 'exit' then current_stock_value - new.quantity
      else current_stock_value + new.quantity
    end;

    if adjusted_stock < 0 then
      raise exception 'Stock insuficiente para registrar la salida.';
    end if;

    update public.inventory_items
    set current_stock = adjusted_stock
    where id = new.inventory_item_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    select current_stock
    into current_stock_value
    from public.inventory_items
    where id = old.inventory_item_id
    for update;

    if current_stock_value is null then
      return old;
    end if;

    adjusted_stock := case
      when old.movement_type = 'exit' then current_stock_value + old.quantity
      else current_stock_value - old.quantity
    end;

    if adjusted_stock < 0 then
      raise exception 'No se puede eliminar este movimiento porque dejaria el stock en negativo.';
    end if;

    update public.inventory_items
    set current_stock = adjusted_stock
    where id = old.inventory_item_id;

    return old;
  end if;

  return null;
end $$;

create or replace function public.update_inventory_movement(
  p_movement_id uuid,
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reason text,
  p_reference_label text,
  p_notes text,
  p_movement_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_movement public.inventory_movements%rowtype;
  old_item_stock numeric(10, 2);
  new_item_stock numeric(10, 2);
  old_effect numeric(10, 2);
  new_effect numeric(10, 2);
begin
  if not public.is_admin_user() then
    raise exception 'No autorizado para actualizar movimientos de inventario.';
  end if;

  if p_movement_type not in ('entry', 'exit') then
    raise exception 'Tipo de movimiento invalido.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'El motivo es obligatorio.';
  end if;

  if p_movement_date is null then
    raise exception 'La fecha del movimiento es obligatoria.';
  end if;

  select *
  into existing_movement
  from public.inventory_movements
  where id = p_movement_id
  for update;

  if existing_movement.id is null then
    raise exception 'El movimiento de inventario no existe.';
  end if;

  old_effect := case
    when existing_movement.movement_type = 'exit' then -existing_movement.quantity
    else existing_movement.quantity
  end;

  new_effect := case
    when p_movement_type = 'exit' then -p_quantity
    else p_quantity
  end;

  if existing_movement.inventory_item_id = p_inventory_item_id then
    select current_stock
    into old_item_stock
    from public.inventory_items
    where id = existing_movement.inventory_item_id
    for update;

    if old_item_stock is null then
      raise exception 'El item de inventario seleccionado no existe.';
    end if;

    old_item_stock := old_item_stock - old_effect + new_effect;

    if old_item_stock < 0 then
      raise exception 'Stock insuficiente para actualizar el movimiento.';
    end if;

    update public.inventory_items
    set current_stock = old_item_stock
    where id = existing_movement.inventory_item_id;
  else
    select current_stock
    into old_item_stock
    from public.inventory_items
    where id = existing_movement.inventory_item_id
    for update;

    if old_item_stock is null then
      raise exception 'El item original del movimiento no existe.';
    end if;

    select current_stock
    into new_item_stock
    from public.inventory_items
    where id = p_inventory_item_id
    for update;

    if new_item_stock is null then
      raise exception 'El nuevo item de inventario no existe.';
    end if;

    old_item_stock := old_item_stock - old_effect;
    new_item_stock := new_item_stock + new_effect;

    if old_item_stock < 0 or new_item_stock < 0 then
      raise exception 'Stock insuficiente para actualizar el movimiento.';
    end if;

    update public.inventory_items
    set current_stock = old_item_stock
    where id = existing_movement.inventory_item_id;

    update public.inventory_items
    set current_stock = new_item_stock
    where id = p_inventory_item_id;
  end if;

  update public.inventory_movements
  set
    inventory_item_id = p_inventory_item_id,
    movement_type = p_movement_type,
    quantity = p_quantity,
    reason = btrim(p_reason),
    reference_label = nullif(btrim(coalesce(p_reference_label, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    movement_date = p_movement_date
  where id = p_movement_id;
end $$;

revoke all on function public.update_inventory_movement(uuid, uuid, text, numeric, text, text, text, date) from public;
grant execute on function public.update_inventory_movement(uuid, uuid, text, numeric, text, text, text, date) to authenticated;

drop trigger if exists inventory_movements_apply_stock_insert on public.inventory_movements;
create trigger inventory_movements_apply_stock_insert
before insert on public.inventory_movements
for each row
execute function public.apply_inventory_stock_change();

drop trigger if exists inventory_movements_apply_stock_delete on public.inventory_movements;
create trigger inventory_movements_apply_stock_delete
before delete on public.inventory_movements
for each row
execute function public.apply_inventory_stock_change();

alter table public.inventory_movements enable row level security;

drop policy if exists "Public read inventory movements" on public.inventory_movements;
drop policy if exists "Admin read inventory movements" on public.inventory_movements;
create policy "Admin read inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Public insert inventory movements" on public.inventory_movements;
drop policy if exists "Admin insert inventory movements" on public.inventory_movements;
create policy "Admin insert inventory movements"
on public.inventory_movements
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update inventory movements" on public.inventory_movements;
drop policy if exists "Admin update inventory movements" on public.inventory_movements;
create policy "Admin update inventory movements"
on public.inventory_movements
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public delete inventory movements" on public.inventory_movements;
drop policy if exists "Admin delete inventory movements" on public.inventory_movements;
create policy "Admin delete inventory movements"
on public.inventory_movements
for delete
to authenticated
using (public.is_admin_user());

-- SUPPORT TICKETS
create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4()
);

alter table public.support_tickets
  add column if not exists module text,
  add column if not exists priority text,
  add column if not exists status text default 'open',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists resolution_note text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.support_tickets
set
  module = case
    when module in ('general', 'products', 'services', 'cash', 'inventory', 'support') then module
    else 'general'
  end,
  priority = case
    when priority in ('low', 'medium', 'high') then priority
    else 'medium'
  end,
  status = case
    when status in ('open', 'in_progress', 'resolved') then status
    else 'open'
  end,
  title = coalesce(nullif(trim(title), ''), 'Caso sin titulo'),
  description = coalesce(nullif(trim(description), ''), 'Caso registrado sin descripcion detallada'),
  resolution_note = nullif(trim(resolution_note), ''),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now())
where
  module is null
  or module not in ('general', 'products', 'services', 'cash', 'inventory', 'support')
  or priority is null
  or priority not in ('low', 'medium', 'high')
  or status is null
  or status not in ('open', 'in_progress', 'resolved')
  or title is null
  or btrim(title) = ''
  or description is null
  or btrim(description) = ''
  or resolution_note is distinct from nullif(trim(resolution_note), '')
  or created_at is null
  or updated_at is null;

alter table public.support_tickets
  alter column module set not null,
  alter column priority set not null,
  alter column status set not null,
  alter column title set not null,
  alter column description set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_module_valid'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_module_valid
      check (module in ('general', 'products', 'services', 'cash', 'inventory', 'support'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_priority_valid'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_priority_valid
      check (priority in ('low', 'medium', 'high'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_tickets_status_valid'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_status_valid
      check (status in ('open', 'in_progress', 'resolved'));
  end if;
end $$;

create or replace function public.set_support_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row
execute function public.set_support_ticket_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists "Public read support tickets" on public.support_tickets;
drop policy if exists "Admin read support tickets" on public.support_tickets;
create policy "Admin read support tickets"
on public.support_tickets
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "Public insert support tickets" on public.support_tickets;
drop policy if exists "Admin insert support tickets" on public.support_tickets;
create policy "Admin insert support tickets"
on public.support_tickets
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Public update support tickets" on public.support_tickets;
drop policy if exists "Admin update support tickets" on public.support_tickets;
create policy "Admin update support tickets"
on public.support_tickets
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

-- STORAGE
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Admin upload product images" on storage.objects;
create policy "Admin upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin_user());

drop policy if exists "Public delete product images" on storage.objects;
drop policy if exists "Admin delete product images" on storage.objects;
create policy "Admin delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin_user());
