create extension if not exists pgcrypto;

create table if not exists public.booths (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_text text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  google_maps_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text not null,
  role text default 'employee',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.booth_schedules (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid references public.booths(id) not null,
  employee_id uuid references public.employees(id) not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  constraint no_overlap unique (employee_id, date, start_time)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  category text,
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid references public.booths(id),
  employee_id uuid references public.employees(id),
  schedule_id uuid references public.booth_schedules(id),
  total_amount numeric(10,2) not null,
  payment_method text default 'cash',
  receipt_photo_url text,
  receipt_photo_local text,
  status text default 'completed',
  synced boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id),
  product_id uuid references public.products(id),
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.employees
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_employee_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where user_id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_employee_is_admin() to authenticated;

alter table public.booths enable row level security;
alter table public.employees enable row level security;
alter table public.booth_schedules enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "admins manage booths" on public.booths;
create policy "admins manage booths"
on public.booths
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees read booths" on public.booths;
create policy "employees read booths"
on public.booths
for select
to authenticated
using (public.current_employee_id() is not null);

drop policy if exists "admins manage employees" on public.employees;
create policy "admins manage employees"
on public.employees
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees read own profile" on public.employees;
create policy "employees read own profile"
on public.employees
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "employees create own profile" on public.employees;
create policy "employees create own profile"
on public.employees
for insert
to authenticated
with check (user_id = auth.uid() and role = 'employee');

drop policy if exists "admins manage booth schedules" on public.booth_schedules;
create policy "admins manage booth schedules"
on public.booth_schedules
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees read own booth schedules" on public.booth_schedules;
create policy "employees read own booth schedules"
on public.booth_schedules
for select
to authenticated
using (employee_id = public.current_employee_id());

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products"
on public.products
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees read products" on public.products;
create policy "employees read products"
on public.products
for select
to authenticated
using (public.current_employee_id() is not null);

drop policy if exists "admins manage sales" on public.sales;
create policy "admins manage sales"
on public.sales
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees manage own sales" on public.sales;
create policy "employees manage own sales"
on public.sales
for all
to authenticated
using (employee_id = public.current_employee_id())
with check (employee_id = public.current_employee_id());

drop policy if exists "admins manage sale items" on public.sale_items;
create policy "admins manage sale items"
on public.sale_items
for all
to authenticated
using (public.current_employee_is_admin())
with check (public.current_employee_is_admin());

drop policy if exists "employees manage own sale items" on public.sale_items;
create policy "employees manage own sale items"
on public.sale_items
for all
to authenticated
using (
  exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.employee_id = public.current_employee_id()
  )
)
with check (
  exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.employee_id = public.current_employee_id()
  )
);
