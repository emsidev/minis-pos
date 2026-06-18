create extension if not exists pgcrypto;
create extension if not exists btree_gist;

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

create unique index if not exists employees_user_id_unique_idx
  on public.employees (user_id)
  where user_id is not null;

create index if not exists employees_email_lower_idx
  on public.employees (lower(email));

create table if not exists public.booth_schedules (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid references public.booths(id) not null,
  operator_employee_id uuid references public.employees(id) not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'scheduled',
  created_at timestamptz default now(),
  constraint booth_schedules_time_order check (start_time < end_time),
  constraint booth_schedules_status_check check (status in ('scheduled', 'closed', 'cancelled'))
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booth_schedules'
      and column_name = 'employee_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booth_schedules'
      and column_name = 'operator_employee_id'
  ) then
    alter table public.booth_schedules
      rename column employee_id to operator_employee_id;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'booth_schedules_employee_id_fkey'
      and conrelid = 'public.booth_schedules'::regclass
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'booth_schedules_operator_employee_id_fkey'
      and conrelid = 'public.booth_schedules'::regclass
  ) then
    alter table public.booth_schedules
      rename constraint booth_schedules_employee_id_fkey
      to booth_schedules_operator_employee_id_fkey;
  end if;
end;
$$;

alter table public.booth_schedules
  add column if not exists status text not null default 'scheduled';

alter table public.booth_schedules
  drop constraint if exists no_overlap;

alter table public.booth_schedules
  drop constraint if exists booth_schedules_time_order;

alter table public.booth_schedules
  add constraint booth_schedules_time_order check (start_time < end_time);

alter table public.booth_schedules
  drop constraint if exists booth_schedules_status_check;

alter table public.booth_schedules
  add constraint booth_schedules_status_check check (status in ('scheduled', 'closed', 'cancelled'));

alter table public.booth_schedules
  drop constraint if exists booth_schedules_employee_times_no_overlap;

create index if not exists booth_schedules_booth_date_status_idx
  on public.booth_schedules (booth_id, date, status);

drop index if exists public.booth_schedules_employee_date_status_idx;

create index if not exists booth_schedules_operator_date_status_idx
  on public.booth_schedules (operator_employee_id, date, status);

create index if not exists booth_schedules_date_status_time_idx
  on public.booth_schedules (date, status, start_time);

create table if not exists public.booth_schedule_assignments (
  schedule_id uuid not null
    constraint booth_schedule_assignments_schedule_id_fkey
    references public.booth_schedules(id) on delete cascade,
  employee_id uuid not null
    constraint booth_schedule_assignments_employee_id_fkey
    references public.employees(id),
  assigned_at timestamptz not null default now(),
  primary key (schedule_id, employee_id)
);

create index if not exists booth_schedule_assignments_employee_idx
  on public.booth_schedule_assignments (employee_id, schedule_id);

insert into public.booth_schedule_assignments (schedule_id, employee_id)
select id, operator_employee_id
from public.booth_schedules
on conflict (schedule_id, employee_id) do nothing;

create table if not exists public.booth_schedule_operator_periods (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null
    constraint booth_schedule_operator_periods_schedule_id_fkey
    references public.booth_schedules(id) on delete cascade,
  operator_employee_id uuid not null
    constraint booth_schedule_operator_periods_operator_employee_id_fkey
    references public.employees(id),
  initiated_by_employee_id uuid not null
    constraint booth_schedule_operator_periods_initiated_by_employee_id_fkey
    references public.employees(id),
  transition_type text not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint booth_schedule_operator_periods_time_order
    check (ends_at is null or starts_at < ends_at),
  constraint booth_schedule_operator_periods_transition_check
    check (transition_type in ('scheduled', 'takeover'))
);

create index if not exists booth_schedule_operator_periods_schedule_time_idx
  on public.booth_schedule_operator_periods (schedule_id, starts_at);

insert into public.booth_schedule_operator_periods (
  schedule_id,
  operator_employee_id,
  initiated_by_employee_id,
  transition_type,
  starts_at
)
select
  schedule.id,
  schedule.operator_employee_id,
  schedule.operator_employee_id,
  'scheduled',
  (schedule.date + schedule.start_time) at time zone 'Asia/Manila'
from public.booth_schedules as schedule
where not exists (
  select 1
  from public.booth_schedule_operator_periods as period
  where period.schedule_id = schedule.id
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

-- Products deployed for a specific booth schedule (inventory for that shift)
create table if not exists public.booth_schedule_products (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.booth_schedules(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null default 0,
  stock integer not null default 0,
  created_at timestamptz default now(),
  constraint booth_schedule_products_unique unique (schedule_id, product_id),
  constraint booth_schedule_products_quantity_nonnegative check (quantity >= 0),
  constraint booth_schedule_products_stock_nonnegative check (stock >= 0)
);

-- Trigger to initialize stock to quantity if not provided
create or replace function public.set_initial_stock()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.stock is null or new.stock = 0 then
    new.stock := new.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_initial_stock on public.booth_schedule_products;

create trigger trigger_set_initial_stock
before insert on public.booth_schedule_products
for each row
execute function public.set_initial_stock();

create table if not exists public.inventory_events (
  id uuid primary key,
  schedule_id uuid references public.booth_schedules(id) on delete cascade not null,
  actor_employee_id uuid references public.employees(id) not null,
  event_type text not null,
  reason text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_events_type_check
    check (event_type in ('opening', 'adjustment', 'admin_override', 'closeout')),
  constraint inventory_events_override_reason_check
    check (event_type <> 'admin_override' or nullif(btrim(reason), '') is not null)
);

create index if not exists inventory_events_schedule_time_idx
  on public.inventory_events (schedule_id, occurred_at);

alter table public.inventory_events
  drop constraint if exists inventory_events_type_check;

alter table public.inventory_events
  add constraint inventory_events_type_check
    check (event_type in ('opening', 'adjustment', 'admin_override', 'closeout'));

create table if not exists public.inventory_event_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.inventory_events(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  previous_stock integer not null,
  resulting_stock integer not null,
  delta integer not null,
  constraint inventory_event_lines_unique unique (event_id, product_id),
  constraint inventory_event_lines_nonnegative
    check (previous_stock >= 0 and resulting_stock >= 0),
  constraint inventory_event_lines_delta_check
    check (resulting_stock = previous_stock + delta)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid references public.booths(id) not null,
  employee_id uuid references public.employees(id) not null,
  schedule_id uuid references public.booth_schedules(id) not null,
  total_amount numeric(10,2) not null,
  payment_method text not null default 'cash',
  receipt_photo_path text,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  constraint sales_payment_method_check
    check (payment_method in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other')),
  constraint sales_non_cash_receipt_check
    check (payment_method = 'cash' or receipt_photo_path is not null)
);

create index if not exists sales_created_at_idx
  on public.sales (created_at desc);

create index if not exists sales_schedule_created_at_idx
  on public.sales (schedule_id, created_at desc);

create index if not exists sales_booth_created_at_idx
  on public.sales (booth_id, created_at desc);

create index if not exists sales_employee_created_at_idx
  on public.sales (employee_id, created_at desc);

create index if not exists sales_receipt_photo_path_idx
  on public.sales (receipt_photo_path)
  where receipt_photo_path is not null;

create table if not exists public.shift_closeouts (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.booth_schedules(id) on delete cascade not null,
  closed_by_employee_id uuid references public.employees(id) not null,
  closed_at timestamptz not null default now(),
  system_cash_sales numeric(10,2) not null,
  counted_cash_sales numeric(10,2) not null,
  cash_variance numeric(10,2) not null,
  system_stock_total integer not null,
  counted_stock_total integer not null,
  stock_variance integer not null,
  reopen_reason text,
  reopened_by_employee_id uuid references public.employees(id),
  reopened_at timestamptz,
  constraint shift_closeouts_cash_nonnegative
    check (system_cash_sales >= 0 and counted_cash_sales >= 0),
  constraint shift_closeouts_stock_nonnegative
    check (system_stock_total >= 0 and counted_stock_total >= 0),
  constraint shift_closeouts_reopen_requires_actor
    check (
      (reopened_at is null and reopened_by_employee_id is null and reopen_reason is null)
      or (
        reopened_at is not null
        and reopened_by_employee_id is not null
        and nullif(btrim(reopen_reason), '') is not null
      )
    )
);

create index if not exists shift_closeouts_schedule_closed_at_idx
  on public.shift_closeouts (schedule_id, closed_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_amount_nonnegative check (unit_price >= 0 and subtotal >= 0)
);

create index if not exists sale_items_sale_id_idx
  on public.sale_items (sale_id);

create index if not exists sale_items_product_id_idx
  on public.sale_items (product_id);

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.employees
  where user_id = (select auth.uid())
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
    where user_id = (select auth.uid())
      and role = 'admin'
      and is_active = true
  );
$$;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_employee_is_admin() to authenticated;

create or replace function public.current_employee_is_assigned(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.booth_schedule_assignments
    where schedule_id = p_schedule_id
      and employee_id = (select public.current_employee_id())
  );
$$;

grant execute on function public.current_employee_is_assigned(uuid) to authenticated;

create or replace function public.get_admin_dashboard(p_date date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_start timestamptz := (p_date::timestamp at time zone 'Asia/Manila');
  v_end timestamptz := ((p_date + 1)::timestamp at time zone 'Asia/Manila');
  v_result jsonb;
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  with
  filtered_sales as materialized (
    select booth_id, payment_method, total_amount
    from public.sales
    where created_at >= v_start
      and created_at < v_end
  ),
  filtered_schedules as materialized (
    select booth_id, status
    from public.booth_schedules
    where date = p_date
  ),
  booth_sales as (
    select
      booth_id,
      coalesce(sum(total_amount), 0)::numeric as total_revenue,
      count(*)::bigint as sale_count,
      coalesce(sum(total_amount) filter (where payment_method = 'cash'), 0)::numeric as cash_revenue,
      coalesce(sum(total_amount) filter (where payment_method <> 'cash'), 0)::numeric as non_cash_revenue
    from filtered_sales
    group by booth_id
  ),
  booth_schedules as (
    select
      booth_id,
      count(*) filter (where status = 'scheduled')::bigint as open_shift_count,
      count(*) filter (where status = 'closed')::bigint as closed_shift_count,
      count(*) filter (where status = 'cancelled')::bigint as cancelled_shift_count
    from filtered_schedules
    group by booth_id
  ),
  booth_rows as (
    select
      booth.id as booth_id,
      booth.name as booth_name,
      booth.is_active,
      coalesce(sales.total_revenue, 0) as total_revenue,
      coalesce(sales.sale_count, 0) as sale_count,
      coalesce(sales.cash_revenue, 0) as cash_revenue,
      coalesce(sales.non_cash_revenue, 0) as non_cash_revenue,
      coalesce(schedules.open_shift_count, 0) as open_shift_count,
      coalesce(schedules.closed_shift_count, 0) as closed_shift_count,
      coalesce(schedules.cancelled_shift_count, 0) as cancelled_shift_count
    from public.booths as booth
    left join booth_sales as sales on sales.booth_id = booth.id
    left join booth_schedules as schedules on schedules.booth_id = booth.id
  ),
  payment_methods(method) as (
    values ('cash'::text), ('gcash'), ('maya'), ('maribank'), ('unionbank'), ('other')
  ),
  payment_rows as (
    select
      methods.method,
      count(sales.payment_method)::bigint as count,
      coalesce(sum(sales.total_amount), 0)::numeric as total
    from payment_methods as methods
    left join filtered_sales as sales on sales.payment_method = methods.method
    group by methods.method
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalRevenue', coalesce((select sum(total_amount) from filtered_sales), 0),
      'saleCount', (select count(*) from filtered_sales),
      'cashRevenue', coalesce((select sum(total_amount) from filtered_sales where payment_method = 'cash'), 0),
      'nonCashRevenue', coalesce((select sum(total_amount) from filtered_sales where payment_method <> 'cash'), 0),
      'openShiftCount', (select count(*) from filtered_schedules where status = 'scheduled'),
      'closedShiftCount', (select count(*) from filtered_schedules where status = 'closed'),
      'cancelledShiftCount', (select count(*) from filtered_schedules where status = 'cancelled')
    ),
    'paymentBreakdown', coalesce((
      select jsonb_agg(
        jsonb_build_object('method', method, 'count', count, 'total', total)
        order by method
      )
      from payment_rows
    ), '[]'::jsonb),
    'boothCards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'boothId', booth_id,
          'boothName', booth_name,
          'isActive', is_active,
          'totalRevenue', total_revenue,
          'saleCount', sale_count,
          'cashRevenue', cash_revenue,
          'nonCashRevenue', non_cash_revenue,
          'openShiftCount', open_shift_count,
          'closedShiftCount', closed_shift_count,
          'cancelledShiftCount', cancelled_shift_count
        )
        order by total_revenue desc, booth_name
      )
      from booth_rows
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_admin_dashboard(date) to authenticated;

drop function if exists public.save_booth_schedule_with_inventory(
  uuid, uuid, uuid, date, time, time, jsonb, date, time
);

drop function if exists public.save_booth_schedule(
  uuid, uuid, uuid, date, time, time, date, time
);

drop function if exists public.save_booth_schedule_range(
  uuid, uuid[], uuid, date, date, time, time, date, time
);

create or replace function public.save_booth_schedule(
  p_schedule_id uuid,
  p_booth_id uuid,
  p_employee_ids uuid[],
  p_operator_employee_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_current_date date,
  p_current_time time
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_schedule public.booth_schedules%rowtype;
  v_schedule_id uuid;
  v_current_employee_id uuid;
begin
  if p_start_time >= p_end_time then
    raise exception using message = 'INVALID_SHIFT_TIME';
  end if;

  if p_employee_ids is null
    or cardinality(p_employee_ids) = 0
    or cardinality(p_employee_ids) <> (
      select count(distinct employee_id)
      from unnest(p_employee_ids) as employee_id
    ) then
    raise exception using message = 'INVALID_ASSIGNMENTS';
  end if;

  if p_operator_employee_id is null
    or not (p_operator_employee_id = any(p_employee_ids)) then
    raise exception using message = 'OPERATOR_NOT_ASSIGNED';
  end if;

  if not exists (
    select 1 from public.booths where id = p_booth_id and is_active = true
  ) then
    raise exception using message = 'BOOTH_INACTIVE';
  end if;

  if exists (
    select 1
    from unnest(p_employee_ids) as requested(employee_id)
    left join public.employees as employee on employee.id = requested.employee_id
    where employee.id is null or employee.is_active is not true
  ) then
    raise exception using message = 'EMPLOYEE_INACTIVE';
  end if;

  if p_schedule_id is null
    and (
      p_date < timezone('Asia/Manila', now())::date
      or (
        p_date = timezone('Asia/Manila', now())::date
        and p_start_time <= timezone('Asia/Manila', now())::time
      )
    ) then
    raise exception using message = 'SHIFT_EDIT_WINDOW_CLOSED';
  end if;

  if p_schedule_id is not null then
    select *
    into v_schedule
    from public.booth_schedules
    where id = p_schedule_id
    for update;

    if not found then
      raise exception using message = 'SCHEDULE_NOT_FOUND';
    end if;

    if v_schedule.status <> 'scheduled' then
      raise exception using message = 'SCHEDULE_CANCELLED';
    end if;
  end if;

  if exists (
    select 1
    from public.booth_schedule_assignments as assignment
    join public.booth_schedules as schedule
      on schedule.id = assignment.schedule_id
    where assignment.employee_id = any(p_employee_ids)
      and schedule.date = p_date
      and schedule.status = 'scheduled'
      and (p_schedule_id is null or schedule.id <> p_schedule_id)
      and schedule.start_time < p_end_time
      and schedule.end_time > p_start_time
  ) then
    raise exception using message = 'SCHEDULE_CONFLICT';
  end if;

  if p_schedule_id is null then
    insert into public.booth_schedules (
      booth_id,
      operator_employee_id,
      date,
      start_time,
      end_time,
      status
    )
    values (
      p_booth_id,
      p_operator_employee_id,
      p_date,
      p_start_time,
      p_end_time,
      'scheduled'
    )
    returning id into v_schedule_id;
  else
    update public.booth_schedules
    set booth_id = p_booth_id,
        operator_employee_id = p_operator_employee_id,
        date = p_date,
        start_time = p_start_time,
        end_time = p_end_time
    where id = p_schedule_id
    returning id into v_schedule_id;
  end if;

  delete from public.booth_schedule_assignments
  where schedule_id = v_schedule_id;

  insert into public.booth_schedule_assignments (schedule_id, employee_id)
  select v_schedule_id, employee_id
  from unnest(p_employee_ids) as employee_id;

  delete from public.booth_schedule_operator_periods
  where schedule_id = v_schedule_id;

  v_current_employee_id := public.current_employee_id();
  if v_current_employee_id is null then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  insert into public.booth_schedule_operator_periods (
    schedule_id,
    operator_employee_id,
    initiated_by_employee_id,
    transition_type,
    starts_at
  )
  values (
    v_schedule_id,
    p_operator_employee_id,
    v_current_employee_id,
    'scheduled',
    (p_date + p_start_time) at time zone 'Asia/Manila'
  );

  return v_schedule_id;
end;
$$;

create or replace function public.save_booth_schedule_range(
  p_booth_id uuid,
  p_employee_ids uuid[],
  p_operator_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_current_date date,
  p_current_time time
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_date date;
  v_schedule_id uuid;
  v_current_employee_id uuid;
  v_created_count integer := 0;
begin
  if p_start_time >= p_end_time then
    raise exception using message = 'INVALID_SHIFT_TIME';
  end if;

  if p_start_date > p_end_date then
    raise exception using message = 'INVALID_DATE_RANGE';
  end if;

  if p_employee_ids is null
    or cardinality(p_employee_ids) = 0
    or cardinality(p_employee_ids) <> (
      select count(distinct employee_id)
      from unnest(p_employee_ids) as employee_id
    ) then
    raise exception using message = 'INVALID_ASSIGNMENTS';
  end if;

  if p_operator_employee_id is null
    or not (p_operator_employee_id = any(p_employee_ids)) then
    raise exception using message = 'OPERATOR_NOT_ASSIGNED';
  end if;

  if not exists (
    select 1 from public.booths where id = p_booth_id and is_active = true
  ) then
    raise exception using message = 'BOOTH_INACTIVE';
  end if;

  if exists (
    select 1
    from unnest(p_employee_ids) as requested(employee_id)
    left join public.employees as employee on employee.id = requested.employee_id
    where employee.id is null or employee.is_active is not true
  ) then
    raise exception using message = 'EMPLOYEE_INACTIVE';
  end if;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    if v_date < p_current_date
      or (v_date = p_current_date and p_start_time <= p_current_time) then
      raise exception using message = 'SHIFT_EDIT_WINDOW_CLOSED';
    end if;
    v_date := v_date + 1;
  end loop;

  if exists (
    select 1
    from public.booth_schedule_assignments as assignment
    join public.booth_schedules as schedule
      on schedule.id = assignment.schedule_id
    where assignment.employee_id = any(p_employee_ids)
      and schedule.date between p_start_date and p_end_date
      and schedule.status = 'scheduled'
      and schedule.start_time < p_end_time
      and schedule.end_time > p_start_time
  ) then
    raise exception using message = 'SCHEDULE_CONFLICT';
  end if;

  v_current_employee_id := public.current_employee_id();
  if v_current_employee_id is null then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    insert into public.booth_schedules (
      booth_id,
      operator_employee_id,
      date,
      start_time,
      end_time,
      status
    )
    values (
      p_booth_id,
      p_operator_employee_id,
      v_date,
      p_start_time,
      p_end_time,
      'scheduled'
    )
    returning id into v_schedule_id;

    insert into public.booth_schedule_assignments (schedule_id, employee_id)
    select v_schedule_id, employee_id
    from unnest(p_employee_ids) as employee_id;

    insert into public.booth_schedule_operator_periods (
      schedule_id,
      operator_employee_id,
      initiated_by_employee_id,
      transition_type,
      starts_at
    )
    values (
      v_schedule_id,
      p_operator_employee_id,
      v_current_employee_id,
      'scheduled',
      (v_date + p_start_time) at time zone 'Asia/Manila'
    );

    v_created_count := v_created_count + 1;
    v_date := v_date + 1;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.claim_shift_operator(p_schedule_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_schedule public.booth_schedules%rowtype;
begin
  select employees.id
  into v_employee_id
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found
    or v_schedule.status <> 'scheduled'
    or v_schedule.date <> timezone('Asia/Manila', now())::date
    or v_schedule.start_time > timezone('Asia/Manila', now())::time
    or v_schedule.end_time <= timezone('Asia/Manila', now())::time then
    raise exception using message = 'SHIFT_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from public.booth_schedule_assignments
    where schedule_id = p_schedule_id
      and employee_id = v_employee_id
  ) then
    raise exception using message = 'EMPLOYEE_NOT_ASSIGNED';
  end if;

  if v_schedule.operator_employee_id = v_employee_id then
    return p_schedule_id;
  end if;

  update public.booth_schedule_operator_periods
  set ends_at = now()
  where schedule_id = p_schedule_id
    and ends_at is null;

  insert into public.booth_schedule_operator_periods (
    schedule_id,
    operator_employee_id,
    initiated_by_employee_id,
    transition_type,
    starts_at
  )
  values (
    p_schedule_id,
    v_employee_id,
    v_employee_id,
    'takeover',
    now()
  );

  update public.booth_schedules
  set operator_employee_id = v_employee_id
  where id = p_schedule_id;

  return p_schedule_id;
end;
$$;

-- Upcoming shifts now receive opening inventory from the assigned employee at shift start.
delete from public.booth_schedule_products as inventory
using public.booth_schedules as schedule
where inventory.schedule_id = schedule.id
  and schedule.status = 'scheduled'
  and (
    schedule.date > timezone('Asia/Manila', now())::date
    or (
      schedule.date = timezone('Asia/Manila', now())::date
      and schedule.start_time > timezone('Asia/Manila', now())::time
    )
  )
  and not exists (
    select 1 from public.sales where sales.schedule_id = schedule.id
  );

create or replace function public.record_shift_inventory_event(
  p_event_id uuid,
  p_schedule_id uuid,
  p_event_type text,
  p_reason text,
  p_occurred_at timestamptz,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_line record;
  v_existing_stock integer;
begin
  select employees.id
  into v_employee_id
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  if exists (select 1 from public.inventory_events where id = p_event_id) then
    return p_event_id;
  end if;

  if p_event_type not in ('opening', 'adjustment') then
    raise exception using message = 'INVALID_INVENTORY_EVENT';
  end if;

  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using message = 'INVALID_INVENTORY_EVENT_TIME';
  end if;

  if not exists (
    select 1
    from public.booth_schedules as schedule
    where schedule.id = p_schedule_id
      and schedule.status = 'scheduled'
      and schedule.date = timezone('Asia/Manila', p_occurred_at)::date
      and schedule.start_time <= timezone('Asia/Manila', p_occurred_at)::time
      and schedule.end_time > timezone('Asia/Manila', p_occurred_at)::time
      and exists (
        select 1
        from public.booth_schedule_operator_periods as period
        where period.schedule_id = schedule.id
          and period.operator_employee_id = v_employee_id
          and period.starts_at <= p_occurred_at
          and (period.ends_at is null or period.ends_at > p_occurred_at)
      )
  ) then
    raise exception using message = 'SHIFT_NOT_ACTIVE_FOR_INVENTORY';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception using message = 'INVENTORY_LINES_REQUIRED';
  end if;

  if (
    select count(*) <> count(distinct item.product_id)
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  ) then
    raise exception using message = 'DUPLICATE_INVENTORY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
    left join public.products on products.id = item.product_id
    where item.product_id is null
      or item.previous_stock is null
      or item.previous_stock < 0
      or item.resulting_stock is null
      or item.resulting_stock < 0
      or products.id is null
      or (
        products.is_available is not true
        and (
          p_event_type = 'opening'
          or not exists (
            select 1
            from public.booth_schedule_products as existing_inventory
            where existing_inventory.schedule_id = p_schedule_id
              and existing_inventory.product_id = item.product_id
          )
        )
      )
  ) then
    raise exception using message = 'INVALID_INVENTORY';
  end if;

  if p_event_type = 'opening' then
    if exists (
      select 1
      from public.booth_schedule_products
      where schedule_id = p_schedule_id
    ) then
      raise exception using message = 'INVENTORY_ALREADY_INITIALIZED';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_lines)
        as item(product_id uuid, previous_stock integer, resulting_stock integer)
      where item.previous_stock <> 0 or item.resulting_stock <= 0
    ) then
      raise exception using message = 'INVALID_OPENING_INVENTORY';
    end if;
  else
    if not exists (
      select 1
      from public.booth_schedule_products
      where schedule_id = p_schedule_id
    ) then
      raise exception using message = 'INVENTORY_NOT_INITIALIZED';
    end if;
  end if;

  insert into public.inventory_events (
    id,
    schedule_id,
    actor_employee_id,
    event_type,
    reason,
    occurred_at
  )
  values (
    p_event_id,
    p_schedule_id,
    v_employee_id,
    p_event_type,
    nullif(btrim(p_reason), ''),
    p_occurred_at
  );

  for v_line in
    select *
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  loop
    select stock
    into v_existing_stock
    from public.booth_schedule_products
    where schedule_id = p_schedule_id
      and product_id = v_line.product_id
    for update;

    if p_event_type = 'opening' then
      insert into public.booth_schedule_products (
        schedule_id,
        product_id,
        quantity,
        stock
      )
      values (
        p_schedule_id,
        v_line.product_id,
        v_line.resulting_stock,
        v_line.resulting_stock
      );
    elsif v_existing_stock is null then
      if v_line.previous_stock <> 0 or v_line.resulting_stock <= 0 then
        raise exception using message = 'INVENTORY_STALE';
      end if;

      insert into public.booth_schedule_products (
        schedule_id,
        product_id,
        quantity,
        stock
      )
      values (p_schedule_id, v_line.product_id, 0, v_line.resulting_stock);
    else
      if v_existing_stock <> v_line.previous_stock then
        raise exception using message = 'INVENTORY_STALE';
      end if;

      update public.booth_schedule_products
      set stock = v_line.resulting_stock
      where schedule_id = p_schedule_id
        and product_id = v_line.product_id;
    end if;

    insert into public.inventory_event_lines (
      event_id,
      product_id,
      previous_stock,
      resulting_stock,
      delta
    )
    values (
      p_event_id,
      v_line.product_id,
      v_line.previous_stock,
      v_line.resulting_stock,
      v_line.resulting_stock - v_line.previous_stock
    );
  end loop;

  return p_event_id;
end;
$$;

create or replace function public.record_admin_inventory_override(
  p_event_id uuid,
  p_schedule_id uuid,
  p_reason text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_line record;
  v_existing_stock integer;
begin
  select employees.id
  into v_employee_id
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.role = 'admin'
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception using message = 'OVERRIDE_REASON_REQUIRED';
  end if;

  if exists (select 1 from public.inventory_events where id = p_event_id) then
    return p_event_id;
  end if;

  if not exists (
    select 1
    from public.booth_schedules as schedule
    where schedule.id = p_schedule_id
      and schedule.status = 'scheduled'
      and schedule.date = timezone('Asia/Manila', now())::date
      and schedule.start_time <= timezone('Asia/Manila', now())::time
      and schedule.end_time > timezone('Asia/Manila', now())::time
      and exists (
        select 1
        from public.booth_schedule_products
        where booth_schedule_products.schedule_id = schedule.id
      )
  ) then
    raise exception using message = 'ACTIVE_INITIALIZED_SHIFT_REQUIRED';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception using message = 'INVENTORY_LINES_REQUIRED';
  end if;

  if (
    select count(*) <> count(distinct item.product_id)
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  ) then
    raise exception using message = 'DUPLICATE_INVENTORY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
    left join public.products on products.id = item.product_id
    where item.product_id is null
      or item.previous_stock is null
      or item.previous_stock < 0
      or item.resulting_stock is null
      or item.resulting_stock < 0
      or products.id is null
      or products.is_available is not true
  ) then
    raise exception using message = 'INVALID_INVENTORY';
  end if;

  insert into public.inventory_events (
    id,
    schedule_id,
    actor_employee_id,
    event_type,
    reason,
    occurred_at
  )
  values (
    p_event_id,
    p_schedule_id,
    v_employee_id,
    'admin_override',
    btrim(p_reason),
    now()
  );

  for v_line in
    select *
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  loop
    select stock
    into v_existing_stock
    from public.booth_schedule_products
    where schedule_id = p_schedule_id
      and product_id = v_line.product_id
    for update;

    if v_existing_stock is null then
      if v_line.previous_stock <> 0 or v_line.resulting_stock <= 0 then
        raise exception using message = 'INVENTORY_STALE';
      end if;

      insert into public.booth_schedule_products (
        schedule_id,
        product_id,
        quantity,
        stock
      )
      values (p_schedule_id, v_line.product_id, 0, v_line.resulting_stock);
    else
      if v_existing_stock <> v_line.previous_stock then
        raise exception using message = 'INVENTORY_STALE';
      end if;

      update public.booth_schedule_products
      set stock = v_line.resulting_stock
      where schedule_id = p_schedule_id
        and product_id = v_line.product_id;
    end if;

    insert into public.inventory_event_lines (
      event_id,
      product_id,
      previous_stock,
      resulting_stock,
      delta
    )
    values (
      p_event_id,
      v_line.product_id,
      v_line.previous_stock,
      v_line.resulting_stock,
      v_line.resulting_stock - v_line.previous_stock
    );
  end loop;

  return p_event_id;
end;
$$;

create or replace function public.close_shift(
  p_schedule_id uuid,
  p_counted_cash_sales numeric,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_employee_role text;
  v_schedule public.booth_schedules%rowtype;
  v_line record;
  v_existing_stock integer;
  v_inventory_row_count integer;
  v_line_count integer;
  v_now timestamptz := now();
  v_system_cash_sales numeric(10,2);
  v_system_stock_total integer := 0;
  v_counted_stock_total integer := 0;
  v_closeout_event_id uuid := gen_random_uuid();
  v_closeout_id uuid;
begin
  select employees.id, employees.role
  into v_employee_id, v_employee_role
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  if p_counted_cash_sales is null or p_counted_cash_sales < 0 then
    raise exception using message = 'INVALID_CASH_COUNT';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception using message = 'INVENTORY_LINES_REQUIRED';
  end if;

  if (
    select count(*) <> count(distinct item.product_id)
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  ) then
    raise exception using message = 'DUPLICATE_INVENTORY';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
    left join public.products on products.id = item.product_id
    where item.product_id is null
      or item.previous_stock is null
      or item.previous_stock < 0
      or item.resulting_stock is null
      or item.resulting_stock < 0
      or products.id is null
  ) then
    raise exception using message = 'INVALID_INVENTORY';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  if v_schedule.status <> 'scheduled'
    or v_schedule.date <> timezone('Asia/Manila', v_now)::date
    or v_schedule.start_time > timezone('Asia/Manila', v_now)::time then
    raise exception using message = 'SHIFT_NOT_ACTIVE_FOR_CLOSEOUT';
  end if;

  if v_schedule.operator_employee_id <> v_employee_id
    and v_employee_role <> 'admin' then
    raise exception using message = 'EMPLOYEE_NOT_OPERATOR';
  end if;

  select count(*)
  into v_inventory_row_count
  from public.booth_schedule_products
  where schedule_id = p_schedule_id;

  if v_inventory_row_count = 0 then
    raise exception using message = 'INVENTORY_NOT_INITIALIZED';
  end if;

  select count(*)
  into v_line_count
  from jsonb_to_recordset(p_lines)
    as item(product_id uuid, previous_stock integer, resulting_stock integer);

  if v_inventory_row_count <> v_line_count then
    raise exception using message = 'CLOSEOUT_LINES_MISMATCH';
  end if;

  select coalesce(sum(total_amount), 0)::numeric(10,2)
  into v_system_cash_sales
  from public.sales
  where schedule_id = p_schedule_id
    and payment_method = 'cash';

  insert into public.inventory_events (
    id,
    schedule_id,
    actor_employee_id,
    event_type,
    occurred_at
  )
  values (
    v_closeout_event_id,
    p_schedule_id,
    v_employee_id,
    'closeout',
    v_now
  );

  for v_line in
    select *
    from jsonb_to_recordset(p_lines)
      as item(product_id uuid, previous_stock integer, resulting_stock integer)
  loop
    select stock
    into v_existing_stock
    from public.booth_schedule_products
    where schedule_id = p_schedule_id
      and product_id = v_line.product_id
    for update;

    if v_existing_stock is null or v_existing_stock <> v_line.previous_stock then
      raise exception using message = 'INVENTORY_STALE';
    end if;

    update public.booth_schedule_products
    set stock = v_line.resulting_stock
    where schedule_id = p_schedule_id
      and product_id = v_line.product_id;

    v_system_stock_total := v_system_stock_total + v_line.previous_stock;
    v_counted_stock_total := v_counted_stock_total + v_line.resulting_stock;

    insert into public.inventory_event_lines (
      event_id,
      product_id,
      previous_stock,
      resulting_stock,
      delta
    )
    values (
      v_closeout_event_id,
      v_line.product_id,
      v_line.previous_stock,
      v_line.resulting_stock,
      v_line.resulting_stock - v_line.previous_stock
    );
  end loop;

  update public.booth_schedule_operator_periods
  set ends_at = coalesce(ends_at, v_now)
  where schedule_id = p_schedule_id
    and ends_at is null;

  insert into public.shift_closeouts (
    schedule_id,
    closed_by_employee_id,
    closed_at,
    system_cash_sales,
    counted_cash_sales,
    cash_variance,
    system_stock_total,
    counted_stock_total,
    stock_variance
  )
  values (
    p_schedule_id,
    v_employee_id,
    v_now,
    v_system_cash_sales,
    p_counted_cash_sales::numeric(10,2),
    (p_counted_cash_sales::numeric(10,2) - v_system_cash_sales)::numeric(10,2),
    v_system_stock_total,
    v_counted_stock_total,
    v_counted_stock_total - v_system_stock_total
  )
  returning id into v_closeout_id;

  update public.booth_schedules
  set status = 'closed'
  where id = p_schedule_id;

  return v_closeout_id;
end;
$$;

create or replace function public.reopen_shift(
  p_schedule_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_schedule public.booth_schedules%rowtype;
  v_closeout_id uuid;
  v_now timestamptz := now();
begin
  select employees.id
  into v_employee_id
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.role = 'admin'
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception using message = 'REOPEN_REASON_REQUIRED';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  if v_schedule.status <> 'closed' then
    raise exception using message = 'SHIFT_NOT_CLOSED';
  end if;

  if v_schedule.date <> timezone('Asia/Manila', v_now)::date then
    raise exception using message = 'REOPEN_WINDOW_CLOSED';
  end if;

  select id
  into v_closeout_id
  from public.shift_closeouts
  where schedule_id = p_schedule_id
    and reopened_at is null
  order by closed_at desc
  limit 1
  for update;

  if v_closeout_id is null then
    raise exception using message = 'CLOSEOUT_NOT_FOUND';
  end if;

  update public.shift_closeouts
  set reopen_reason = btrim(p_reason),
      reopened_by_employee_id = v_employee_id,
      reopened_at = v_now
  where id = v_closeout_id;

  update public.booth_schedules
  set status = 'scheduled'
  where id = p_schedule_id;

  insert into public.booth_schedule_operator_periods (
    schedule_id,
    operator_employee_id,
    initiated_by_employee_id,
    transition_type,
    starts_at
  )
  values (
    p_schedule_id,
    v_schedule.operator_employee_id,
    v_employee_id,
    'takeover',
    v_now
  );

  return v_closeout_id;
end;
$$;

create or replace function public.deactivate_booth_and_cancel_future_schedules(
  p_booth_id uuid,
  p_current_date date,
  p_current_time time
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_cancelled_count integer := 0;
begin
  perform 1
  from public.booths
  where id = p_booth_id
  for update;

  if not found then
    raise exception using message = 'BOOTH_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.booth_schedules
    where booth_id = p_booth_id
      and status = 'scheduled'
      and date = p_current_date
      and start_time <= p_current_time
      and end_time > p_current_time
  ) then
    raise exception using message = 'ACTIVE_SHIFT_BLOCKS_DEACTIVATION';
  end if;

  update public.booths
  set is_active = false
  where id = p_booth_id;

  update public.booth_schedules
  set status = 'cancelled'
  where booth_id = p_booth_id
    and status = 'scheduled'
    and (
      date > p_current_date
      or (date = p_current_date and start_time > p_current_time)
    );

  get diagnostics v_cancelled_count = row_count;
  return v_cancelled_count;
end;
$$;

create or replace function public.finalize_pos_sale(
  p_sale_id uuid,
  p_booth_id uuid,
  p_schedule_id uuid,
  p_total_amount numeric,
  p_payment_method text,
  p_receipt_photo_path text,
  p_created_at timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_existing_employee_id uuid;
  v_expected_total numeric(10,2);
  v_expected_item_count integer;
  v_locked_item_count integer := 0;
  v_item record;
begin
  select employees.id
  into v_employee_id
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee_id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  select sales.employee_id
  into v_existing_employee_id
  from public.sales
  where sales.id = p_sale_id;

  if found then
    if v_existing_employee_id <> v_employee_id then
      raise exception using message = 'SALE_ID_CONFLICT';
    end if;
    return p_sale_id;
  end if;

  if p_payment_method is null
    or p_payment_method not in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other') then
    raise exception using message = 'INVALID_PAYMENT_METHOD';
  end if;

  if p_receipt_photo_path is not null
    and p_receipt_photo_path not like (v_employee_id::text || '/%') then
    raise exception using message = 'INVALID_RECEIPT_PHOTO_PATH';
  end if;

  if p_payment_method <> 'cash' and p_receipt_photo_path is null then
    raise exception using message = 'RECEIPT_PHOTO_REQUIRED';
  end if;

  if p_receipt_photo_path is not null
    and not exists (
      select 1
      from storage.objects
      where bucket_id = 'receipts'
        and name = p_receipt_photo_path
    ) then
    raise exception using message = 'RECEIPT_PHOTO_NOT_FOUND';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception using message = 'SALE_ITEMS_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.booth_schedules as schedule
    where schedule.id = p_schedule_id
      and schedule.booth_id = p_booth_id
      and schedule.status = 'scheduled'
      and schedule.date = timezone('Asia/Manila', p_created_at)::date
      and schedule.start_time <= timezone('Asia/Manila', p_created_at)::time
      and schedule.end_time > timezone('Asia/Manila', p_created_at)::time
      and p_created_at <= now() + interval '5 minutes'
      and exists (
        select 1
        from public.booth_schedule_operator_periods as period
        where period.schedule_id = schedule.id
          and period.operator_employee_id = v_employee_id
          and period.starts_at <= p_created_at
          and (period.ends_at is null or period.ends_at > p_created_at)
      )
  ) then
    raise exception using message = 'INVALID_ACTIVE_SCHEDULE';
  end if;

  if not exists (
    select 1
    from public.booth_schedule_products
    where booth_schedule_products.schedule_id = p_schedule_id
  ) then
    raise exception using message = 'INVENTORY_NOT_INITIALIZED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items)
      as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer)
    left join public.products on products.id = item.product_id
    where item.product_id is null
      or item.quantity is null
      or item.quantity <= 0
      or item.unit_price is null
      or item.unit_price < 0
      or item.expected_stock is null
      or item.expected_stock < item.quantity
      or products.id is null
  ) then
    raise exception using message = 'INVALID_SALE_ITEMS';
  end if;

  if (
    select count(*) <> count(distinct item.product_id)
    from jsonb_to_recordset(p_items)
      as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer)
  ) then
    raise exception using message = 'DUPLICATE_SALE_ITEMS';
  end if;

  select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2)
  into v_expected_total
  from jsonb_to_recordset(p_items)
    as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer);

  select count(*)
  into v_expected_item_count
  from jsonb_to_recordset(p_items)
    as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer);

  if v_expected_total <> p_total_amount::numeric(10,2) then
    raise exception using message = 'SALE_TOTAL_MISMATCH';
  end if;

  for v_item in
    select item.product_id, item.quantity, item.unit_price, item.expected_stock, inventory.stock
    from public.booth_schedule_products as inventory
    join jsonb_to_recordset(p_items)
      as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer)
      on inventory.schedule_id = p_schedule_id
      and inventory.product_id = item.product_id
    for update of inventory
  loop
    v_locked_item_count := v_locked_item_count + 1;

    if v_item.stock <> v_item.expected_stock then
      raise exception using message = 'INVENTORY_STALE';
    end if;
  end loop;

  if v_locked_item_count <> v_expected_item_count then
    raise exception using message = 'INVENTORY_STALE';
  end if;

  insert into public.sales (
    id,
    booth_id,
    employee_id,
    schedule_id,
    total_amount,
    payment_method,
    receipt_photo_path,
    status,
    created_at
  )
  values (
    p_sale_id,
    p_booth_id,
    v_employee_id,
    p_schedule_id,
    p_total_amount,
    p_payment_method,
    p_receipt_photo_path,
    'completed',
    coalesce(p_created_at, now())
  );

  insert into public.sale_items (id, sale_id, product_id, quantity, unit_price, subtotal)
  select
    gen_random_uuid(),
    p_sale_id,
    item.product_id,
    item.quantity,
    item.unit_price,
    (item.quantity * item.unit_price)::numeric(10,2)
  from jsonb_to_recordset(p_items)
    as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer);

  update public.booth_schedule_products as inventory
  set stock = inventory.stock - item.quantity
  from jsonb_to_recordset(p_items)
    as item(product_id uuid, quantity integer, unit_price numeric, expected_stock integer)
  where inventory.schedule_id = p_schedule_id
    and inventory.product_id = item.product_id;

  return p_sale_id;
end;
$$;

revoke execute on function public.save_booth_schedule(uuid, uuid, uuid[], uuid, date, time, time, date, time) from public;
revoke execute on function public.save_booth_schedule_range(uuid, uuid[], uuid, date, date, time, time, date, time) from public;
revoke execute on function public.claim_shift_operator(uuid) from public;
revoke execute on function public.close_shift(uuid, numeric, jsonb) from public;
revoke execute on function public.deactivate_booth_and_cancel_future_schedules(uuid, date, time) from public;
revoke execute on function public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb) from public;
revoke execute on function public.record_shift_inventory_event(uuid, uuid, text, text, timestamptz, jsonb) from public;
revoke execute on function public.record_admin_inventory_override(uuid, uuid, text, jsonb) from public;
revoke execute on function public.reopen_shift(uuid, text) from public;
grant execute on function public.save_booth_schedule(uuid, uuid, uuid[], uuid, date, time, time, date, time) to authenticated;
grant execute on function public.save_booth_schedule_range(uuid, uuid[], uuid, date, date, time, time, date, time) to authenticated;
grant execute on function public.claim_shift_operator(uuid) to authenticated;
grant execute on function public.close_shift(uuid, numeric, jsonb) to authenticated;
grant execute on function public.deactivate_booth_and_cancel_future_schedules(uuid, date, time) to authenticated;
grant execute on function public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.record_shift_inventory_event(uuid, uuid, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.record_admin_inventory_override(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.reopen_shift(uuid, text) to authenticated;

alter table public.booths enable row level security;
alter table public.employees enable row level security;
alter table public.booth_schedules enable row level security;
alter table public.booth_schedule_assignments enable row level security;
alter table public.booth_schedule_operator_periods enable row level security;
alter table public.products enable row level security;
alter table public.booth_schedule_products enable row level security;
alter table public.inventory_events enable row level security;
alter table public.inventory_event_lines enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.shift_closeouts enable row level security;

drop policy if exists "admins manage booths" on public.booths;
create policy "admins manage booths"
on public.booths
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read booths" on public.booths;
create policy "employees read booths"
on public.booths
for select
to authenticated
using ((select public.current_employee_id()) is not null);

drop policy if exists "admins manage employees" on public.employees;
create policy "admins manage employees"
on public.employees
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read own profile" on public.employees;
create policy "employees read own profile"
on public.employees
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "employees create own profile" on public.employees;
create policy "employees create own profile"
on public.employees
for insert
to authenticated
with check (user_id = (select auth.uid()) and role = 'employee');

drop policy if exists "admins manage booth schedules" on public.booth_schedules;
create policy "admins manage booth schedules"
on public.booth_schedules
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read own booth schedules" on public.booth_schedules;
drop policy if exists "employees read assigned booth schedules" on public.booth_schedules;
create policy "employees read assigned booth schedules"
on public.booth_schedules
for select
to authenticated
using (public.current_employee_is_assigned(id));

drop policy if exists "admins manage booth schedule assignments" on public.booth_schedule_assignments;
create policy "admins manage booth schedule assignments"
on public.booth_schedule_assignments
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read assigned team" on public.booth_schedule_assignments;
create policy "employees read assigned team"
on public.booth_schedule_assignments
for select
to authenticated
using (public.current_employee_is_assigned(schedule_id));

drop policy if exists "admins manage operator periods" on public.booth_schedule_operator_periods;
create policy "admins manage operator periods"
on public.booth_schedule_operator_periods
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "admins read operator periods" on public.booth_schedule_operator_periods;

drop policy if exists "employees read assigned operator periods" on public.booth_schedule_operator_periods;
create policy "employees read assigned operator periods"
on public.booth_schedule_operator_periods
for select
to authenticated
using (public.current_employee_is_assigned(schedule_id));

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products"
on public.products
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read products" on public.products;
create policy "employees read products"
on public.products
for select
to authenticated
using ((select public.current_employee_id()) is not null);

drop policy if exists "admins manage booth schedule products" on public.booth_schedule_products;
create policy "admins manage booth schedule products"
on public.booth_schedule_products
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read own booth schedule products" on public.booth_schedule_products;
create policy "employees read own booth schedule products"
on public.booth_schedule_products
for select
to authenticated
using (
  exists (
    select 1
    where public.current_employee_is_assigned(booth_schedule_products.schedule_id)
  )
);

drop policy if exists "employees manage own booth schedule products" on public.booth_schedule_products;

drop policy if exists "admins read inventory events" on public.inventory_events;
create policy "admins read inventory events"
on public.inventory_events
for select
to authenticated
using ((select public.current_employee_is_admin()));

drop policy if exists "employees read own inventory events" on public.inventory_events;
create policy "employees read own inventory events"
on public.inventory_events
for select
to authenticated
using (
  exists (
    select 1
    where public.current_employee_is_assigned(inventory_events.schedule_id)
  )
);

drop policy if exists "admins read inventory event lines" on public.inventory_event_lines;
create policy "admins read inventory event lines"
on public.inventory_event_lines
for select
to authenticated
using ((select public.current_employee_is_admin()));

drop policy if exists "employees read own inventory event lines" on public.inventory_event_lines;
create policy "employees read own inventory event lines"
on public.inventory_event_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.inventory_events
    where inventory_events.id = inventory_event_lines.event_id
      and public.current_employee_is_assigned(inventory_events.schedule_id)
  )
);

drop policy if exists "admins manage sales" on public.sales;
create policy "admins manage sales"
on public.sales
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees manage own sales" on public.sales;
drop policy if exists "employees read own sales" on public.sales;
drop policy if exists "employees read assigned shift sales" on public.sales;
create policy "employees read assigned shift sales"
on public.sales
for select
to authenticated
using (public.current_employee_is_assigned(schedule_id));

drop policy if exists "admins manage sale items" on public.sale_items;
create policy "admins manage sale items"
on public.sale_items
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees manage own sale items" on public.sale_items;
drop policy if exists "employees read own sale items" on public.sale_items;
drop policy if exists "employees read assigned sale items" on public.sale_items;
create policy "employees read assigned sale items"
on public.sale_items
for select
to authenticated
using (
  exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and public.current_employee_is_assigned(sales.schedule_id)
  )
);

drop policy if exists "admins manage shift closeouts" on public.shift_closeouts;
create policy "admins manage shift closeouts"
on public.shift_closeouts
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read assigned shift closeouts" on public.shift_closeouts;
create policy "employees read assigned shift closeouts"
on public.shift_closeouts
for select
to authenticated
using (public.current_employee_is_assigned(schedule_id));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "employees upload own receipt photos" on storage.objects;
create policy "employees upload own receipt photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_employee_id()::text
);

drop policy if exists "employees update own receipt photos" on storage.objects;
create policy "employees update own receipt photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_employee_id()::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = public.current_employee_id()::text
);

drop policy if exists "employees read own receipt photos" on storage.objects;
drop policy if exists "employees read assigned receipt photos" on storage.objects;
create policy "employees read assigned receipt photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and exists (
    select 1
    from public.sales
    where sales.receipt_photo_path = storage.objects.name
      and public.current_employee_is_assigned(sales.schedule_id)
  )
);

drop policy if exists "admins read receipt photos" on storage.objects;
create policy "admins read receipt photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.current_employee_is_admin()
);
