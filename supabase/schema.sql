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
  approval_status text not null default 'approved',
  created_at timestamptz default now(),
  constraint employees_approval_status_check
    check (approval_status in ('pending', 'approved'))
);

create unique index if not exists employees_user_id_unique_idx
  on public.employees (user_id)
  where user_id is not null;

create index if not exists employees_email_lower_idx
  on public.employees (lower(email));


alter table public.employees
  add column if not exists approval_status text not null default 'approved';

update public.employees
set approval_status = 'approved'
where approval_status is null;

alter table public.employees
  drop constraint if exists employees_approval_status_check;

alter table public.employees
  add constraint employees_approval_status_check
    check (approval_status in ('pending', 'approved'));


    create index if not exists employees_approval_status_idx
      on public.employees (approval_status, is_active);

create table if not exists public.booth_schedules (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid references public.booths(id) not null,
  operator_employee_id uuid references public.employees(id),
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
  alter column operator_employee_id drop not null;

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
where operator_employee_id is not null
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
where schedule.operator_employee_id is not null
  and not exists (
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

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promo_type text not null,
  starts_on date not null,
  ends_on date not null,
  criteria jsonb not null default '{}'::jsonb,
  benefit jsonb not null default '{}'::jsonb,
  requires_admin_approval boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promos_type_check
    check (
      promo_type in (
        'percent_off',
        'fixed_amount_off',
        'special_price',
        'buy_x_get_y',
        'bundle_price',
        'free_item'
      )
    ),
  constraint promos_date_order_check check (starts_on <= ends_on)
);

create index if not exists promos_active_window_idx
  on public.promos (is_active, starts_on, ends_on);

create table if not exists public.promo_products (
  promo_id uuid not null
    constraint promo_products_promo_id_fkey
    references public.promos(id) on delete cascade,
  product_id uuid not null
    constraint promo_products_product_id_fkey
    references public.products(id),
  role text not null default 'qualifying',
  created_at timestamptz not null default now(),
  primary key (promo_id, product_id, role),
  constraint promo_products_role_check
    check (role in ('qualifying', 'reward'))
);

create index if not exists promo_products_product_role_idx
  on public.promo_products (product_id, role);

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
  id uuid primary key default gen_random_uuid(),
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

alter table public.inventory_events
  alter column id set default gen_random_uuid();

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

alter table public.sales
  add column if not exists updated_at timestamptz;

update public.sales
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.sales
  alter column updated_at set default now();

alter table public.sales
  alter column updated_at set not null;

alter table public.sales
  add column if not exists promo_id uuid references public.promos(id);

alter table public.sales
  add column if not exists promo_name text;

alter table public.sales
  add column if not exists promo_type text;

alter table public.sales
  add column if not exists promo_discount_total numeric(10,2) not null default 0;

alter table public.sales
  add column if not exists promo_approval_id uuid;

alter table public.sales
  drop constraint if exists sales_status_check;

alter table public.sales
  add constraint sales_status_check
    check (status in ('completed', 'deleted'));

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

create index if not exists sales_promo_id_idx
  on public.sales (promo_id)
  where promo_id is not null;

  create table if not exists public.sale_payments (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid references public.sales(id) on delete cascade not null,
    payment_method text not null,
    amount numeric(10,2) not null,
    created_at timestamptz not null default now(),
    constraint sale_payments_payment_method_check
      check (payment_method in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other')),
    constraint sale_payments_amount_positive
      check (amount > 0)
  );

  create index if not exists sale_payments_sale_id_idx
    on public.sale_payments (sale_id);

  create index if not exists sale_payments_method_idx
    on public.sale_payments (payment_method);

create table if not exists public.shift_closeouts (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.booth_schedules(id) on delete cascade not null,
  closed_by_employee_id uuid references public.employees(id) not null,
  closed_at timestamptz not null default now(),
  system_cash_sales numeric(10,2) not null,
  counted_cash_sales numeric(10,2) not null,
  cash_deductions_total numeric(10,2) not null default 0,
  cash_variance numeric(10,2) not null,
  system_stock_total integer not null,
  counted_stock_total integer not null,
  stock_variance integer not null,
  reopen_reason text,
  reopened_by_employee_id uuid references public.employees(id),
  reopened_at timestamptz,
  constraint shift_closeouts_cash_nonnegative
    check (
      system_cash_sales >= 0
      and counted_cash_sales >= 0
      and cash_deductions_total >= 0
    ),
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

alter table public.shift_closeouts
  add column if not exists cash_deductions_total numeric(10,2) not null default 0;

alter table public.shift_closeouts
  drop constraint if exists shift_closeouts_cash_nonnegative;

alter table public.shift_closeouts
  add constraint shift_closeouts_cash_nonnegative
    check (
      system_cash_sales >= 0
      and counted_cash_sales >= 0
      and cash_deductions_total >= 0
    );

create table if not exists public.shift_action_approvals (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.booth_schedules(id) on delete cascade not null,
  requested_by_employee_id uuid references public.employees(id) not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  resolved_by_employee_id uuid references public.employees(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_action_approvals_action_type_check
    check (
      action_type in (
        'reopen_shift',
        'edit_sale',
        'delete_sale',
        'apply_promo',
        'cash_deduction'
      )
    ),
  constraint shift_action_approvals_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint shift_action_approvals_resolution_check
    check (
      (status = 'pending' and resolved_by_employee_id is null and resolved_at is null)
      or (
        status in ('approved', 'rejected')
        and resolved_by_employee_id is not null
        and resolved_at is not null
      )
    )
);

create index if not exists shift_action_approvals_schedule_status_idx
  on public.shift_action_approvals (schedule_id, status, created_at desc);

create index if not exists shift_action_approvals_requester_status_idx
  on public.shift_action_approvals (requested_by_employee_id, status, created_at desc);

alter table public.shift_action_approvals
  drop constraint if exists shift_action_approvals_action_type_check;

alter table public.shift_action_approvals
  add constraint shift_action_approvals_action_type_check
    check (
      action_type in (
        'reopen_shift',
        'edit_sale',
        'delete_sale',
        'apply_promo',
        'cash_deduction'
      )
    );

alter table public.sales
  drop constraint if exists sales_promo_approval_id_fkey;

alter table public.sales
  add constraint sales_promo_approval_id_fkey
    foreign key (promo_approval_id)
    references public.shift_action_approvals(id);

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

alter table public.sale_items
  add column if not exists base_unit_price numeric(10,2);

update public.sale_items
set base_unit_price = coalesce(base_unit_price, unit_price)
where base_unit_price is null;

alter table public.sale_items
  alter column base_unit_price set not null;

alter table public.sale_items
  add column if not exists discount_amount numeric(10,2) not null default 0;

alter table public.sale_items
  drop constraint if exists sale_items_discount_nonnegative;

alter table public.sale_items
  add constraint sale_items_discount_nonnegative
    check (base_unit_price >= 0 and discount_amount >= 0);

create index if not exists sale_items_sale_id_idx
  on public.sale_items (sale_id);

create index if not exists sale_items_product_id_idx
  on public.sale_items (product_id);

create table if not exists public.sale_promos (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null
    constraint sale_promos_sale_id_fkey
    references public.sales(id) on delete cascade,
  promo_id uuid
    constraint sale_promos_promo_id_fkey
    references public.promos(id),
  promo_name text not null,
  promo_type text not null,
  discount_total numeric(10,2) not null default 0,
  promo_approval_id uuid
    constraint sale_promos_promo_approval_id_fkey
    references public.shift_action_approvals(id),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sale_promos_sale_id_unique unique (sale_id),
  constraint sale_promos_discount_nonnegative check (discount_total >= 0)
);

create unique index if not exists sale_promos_approval_unique_idx
  on public.sale_promos (promo_approval_id)
  where promo_approval_id is not null;

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
  v_trend_start timestamptz := ((p_date - 6)::timestamp at time zone 'Asia/Manila');
  v_result jsonb;
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  with
  filtered_sales as materialized (
    select
      sale.id,
      sale.booth_id,
      sale.employee_id,
      sale.schedule_id,
      sale.payment_method,
      sale.receipt_photo_path,
      sale.status,
      sale.total_amount,
      sale.created_at
    from public.sales as sale
    where sale.created_at >= v_start
      and sale.created_at < v_end
      and sale.status = 'completed'
  ),
  filtered_sale_payments as materialized (
    select
      sale.id as sale_id,
      sale.booth_id,
      payment.payment_method,
      payment.amount
    from filtered_sales as sale
    join public.sale_payments as payment
      on payment.sale_id = sale.id

    union all

    select
      sale.id as sale_id,
      sale.booth_id,
      sale.payment_method,
      sale.total_amount as amount
    from filtered_sales as sale
    where not exists (
      select 1
      from public.sale_payments as payment
      where payment.sale_id = sale.id
    )
  ),
  filtered_schedules as materialized (
    select booth_id, status
    from public.booth_schedules
    where date = p_date
  ),
  trend_sales as materialized (
    select sale.id, sale.created_at, sale.total_amount
    from public.sales as sale
    where sale.created_at >= v_trend_start
      and sale.created_at < v_end
      and sale.status = 'completed'
  ),
  filtered_sale_items as materialized (
    select
      item.sale_id,
      item.product_id,
      item.quantity,
      item.subtotal,
      coalesce(product.name, 'Unknown Product') as product_name
    from public.sale_items as item
    join filtered_sales as sale on sale.id = item.sale_id
    left join public.products as product on product.id = item.product_id
  ),
  booth_sales as (
    select
      sale_totals.booth_id,
      sale_totals.total_revenue,
      sale_totals.sale_count,
      coalesce(payment_totals.cash_revenue, 0) as cash_revenue,
      coalesce(payment_totals.non_cash_revenue, 0) as non_cash_revenue
    from (
      select
        booth_id,
        coalesce(sum(total_amount), 0)::numeric as total_revenue,
        count(*)::bigint as sale_count
      from filtered_sales
      group by booth_id
    ) as sale_totals
    left join (
      select
        booth_id,
        coalesce(sum(amount) filter (where payment_method = 'cash'), 0)::numeric as cash_revenue,
        coalesce(sum(amount) filter (where payment_method <> 'cash'), 0)::numeric as non_cash_revenue
      from filtered_sale_payments
      group by booth_id
    ) as payment_totals
      on payment_totals.booth_id = sale_totals.booth_id
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
      count(payment.payment_method)::bigint as count,
      coalesce(sum(payment.amount), 0)::numeric as total
    from payment_methods as methods
    left join filtered_sale_payments as payment
      on payment.payment_method = methods.method
    group by methods.method
  ),
  trend_days as (
    select generate_series(p_date - 6, p_date, interval '1 day')::date as trend_date
  ),
  trend_rows as (
    select
      days.trend_date,
      coalesce(sum(sale.total_amount), 0)::numeric as revenue,
      count(sale.id)::bigint as transactions
    from trend_days as days
    left join trend_sales as sale
      on sale.created_at >= (days.trend_date::timestamp at time zone 'Asia/Manila')
      and sale.created_at < ((days.trend_date + 1)::timestamp at time zone 'Asia/Manila')
    group by days.trend_date
  ),
  top_product_rows as (
    select
      item.product_id,
      max(item.product_name) as product_name,
      coalesce(sum(item.quantity), 0)::bigint as quantity_sold,
      coalesce(sum(item.subtotal), 0)::numeric as revenue
    from filtered_sale_items as item
    group by item.product_id
    order by revenue desc, quantity_sold desc, product_name
    limit 5
  ),
  recent_transaction_rows as (
    select
      sale.id,
      sale.created_at,
      coalesce(booth.name, 'Unknown booth') as booth_name,
      coalesce(employee.name, 'Unknown employee') as employee_name,
      sale.payment_method,
      sale.total_amount,
      sale.receipt_photo_path is not null as has_receipt,
      sale.receipt_photo_path,
      coalesce(
        (
          sale.payment_method <> 'cash'
          and sale.receipt_photo_path is not null
          and schedule.status = 'scheduled'
        ),
        false
      ) as can_edit_receipt,
      sale.status
    from filtered_sales as sale
    left join public.booths as booth on booth.id = sale.booth_id
    left join public.employees as employee on employee.id = sale.employee_id
    left join public.booth_schedules as schedule on schedule.id = sale.schedule_id
    order by sale.created_at desc, sale.id desc
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalRevenue', coalesce((select sum(total_amount) from filtered_sales), 0),
      'saleCount', (select count(*) from filtered_sales),
      'cashRevenue', coalesce((
        select sum(amount)
        from filtered_sale_payments
        where payment_method = 'cash'
      ), 0),

      'nonCashRevenue', coalesce((
        select sum(amount)
        from filtered_sale_payments
        where payment_method <> 'cash'
      ), 0),
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
    ), '[]'::jsonb),
    'trendSeries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', trend_date,
          'revenue', revenue,
          'transactions', transactions
        )
        order by trend_date
      )
      from trend_rows
    ), '[]'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productId', product_id,
          'productName', product_name,
          'quantitySold', quantity_sold,
          'revenue', revenue
        )
        order by revenue desc, quantity_sold desc, product_name
      )
      from top_product_rows
    ), '[]'::jsonb),
    'recentTransactions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'createdAt', created_at,
          'boothName', booth_name,
          'employeeName', employee_name,
          'paymentMethod', payment_method,
          'totalAmount', total_amount,
          'hasReceipt', has_receipt,
          'receiptPhotoPath', receipt_photo_path,
          'canEditReceipt', can_edit_receipt,
          'status', status
        )
        order by created_at desc, id desc
      )
      from recent_transaction_rows
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
  v_now timestamptz := now();
  v_requested_employee_ids uuid[] := coalesce(p_employee_ids, array[]::uuid[]);
  v_started boolean := false;
begin
  if p_start_time >= p_end_time then
    raise exception using message = 'INVALID_SHIFT_TIME';
  end if;

  if cardinality(v_requested_employee_ids) <> (
      select count(distinct employee_id)
      from unnest(v_requested_employee_ids) as employee_id
    ) then
    raise exception using message = 'INVALID_ASSIGNMENTS';
  end if;

  if p_operator_employee_id is not null
    and not (p_operator_employee_id = any(v_requested_employee_ids)) then
    raise exception using message = 'OPERATOR_NOT_ASSIGNED';
  end if;

  if not exists (
    select 1 from public.booths where id = p_booth_id and is_active = true
  ) then
    raise exception using message = 'BOOTH_INACTIVE';
  end if;

  if exists (
    select 1
    from unnest(v_requested_employee_ids) as requested(employee_id)
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
    raise exception using message = 'PAST_SHIFT_START_TIME';
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

    v_started := v_schedule.date < p_current_date
      or (
        v_schedule.date = p_current_date
        and v_schedule.start_time <= p_current_time
      )
      or exists (
        select 1
        from public.booth_schedule_operator_periods as period
        where period.schedule_id = p_schedule_id
          and period.starts_at <= v_now
      );
    if not v_started
      and (
        p_date < p_current_date
        or (
          p_date = p_current_date
          and p_start_time <= p_current_time
        )
      ) then
      raise exception using message = 'PAST_SHIFT_START_TIME';
    end if;
  end if;

  if cardinality(v_requested_employee_ids) > 0
    and exists (
    select 1
    from public.booth_schedule_assignments as assignment
    join public.booth_schedules as schedule
      on schedule.id = assignment.schedule_id
    where assignment.employee_id = any(v_requested_employee_ids)
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

  if cardinality(v_requested_employee_ids) > 0 then
    insert into public.booth_schedule_assignments (schedule_id, employee_id)
    select v_schedule_id, employee_id
    from unnest(v_requested_employee_ids) as employee_id;
  end if;

  if p_schedule_id is null or not v_started then
    delete from public.booth_schedule_operator_periods
    where schedule_id = v_schedule_id;

    if p_operator_employee_id is not null then
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
    end if;
  elsif v_schedule.operator_employee_id is distinct from p_operator_employee_id then
    update public.booth_schedule_operator_periods
    set ends_at = coalesce(ends_at, v_now)
    where schedule_id = v_schedule_id
      and ends_at is null;

    if p_operator_employee_id is not null then
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
        'takeover',
        v_now
      );
    end if;
  end if;

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
  v_requested_employee_ids uuid[] := coalesce(p_employee_ids, array[]::uuid[]);
begin
  if p_start_time >= p_end_time then
    raise exception using message = 'INVALID_SHIFT_TIME';
  end if;

  if p_start_date > p_end_date then
    raise exception using message = 'INVALID_DATE_RANGE';
  end if;

  if cardinality(v_requested_employee_ids) <> (
      select count(distinct employee_id)
      from unnest(v_requested_employee_ids) as employee_id
    ) then
    raise exception using message = 'INVALID_ASSIGNMENTS';
  end if;

  if p_operator_employee_id is not null
    and not (p_operator_employee_id = any(v_requested_employee_ids)) then
    raise exception using message = 'OPERATOR_NOT_ASSIGNED';
  end if;

  if not exists (
    select 1 from public.booths where id = p_booth_id and is_active = true
  ) then
    raise exception using message = 'BOOTH_INACTIVE';
  end if;

  if exists (
    select 1
    from unnest(v_requested_employee_ids) as requested(employee_id)
    left join public.employees as employee on employee.id = requested.employee_id
    where employee.id is null or employee.is_active is not true
  ) then
    raise exception using message = 'EMPLOYEE_INACTIVE';
  end if;

  v_date := p_start_date;
  while v_date <= p_end_date loop
    if v_date < p_current_date
      or (v_date = p_current_date and p_start_time <= p_current_time) then
      raise exception using message = 'PAST_SHIFT_START_TIME';
    end if;
    v_date := v_date + 1;
  end loop;

  if cardinality(v_requested_employee_ids) > 0
    and exists (
    select 1
    from public.booth_schedule_assignments as assignment
    join public.booth_schedules as schedule
      on schedule.id = assignment.schedule_id
    where assignment.employee_id = any(v_requested_employee_ids)
      and schedule.date between p_start_date and p_end_date
      and schedule.status = 'scheduled'
      and schedule.start_time < p_end_time
      and schedule.end_time > p_start_time
  ) then
    raise exception using message = 'SCHEDULE_CONFLICT';
  end if;

  if p_operator_employee_id is not null then
    v_current_employee_id := public.current_employee_id();
    if v_current_employee_id is null then
      raise exception using message = 'ADMIN_NOT_AUTHORIZED';
    end if;
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

    if cardinality(v_requested_employee_ids) > 0 then
      insert into public.booth_schedule_assignments (schedule_id, employee_id)
      select v_schedule_id, employee_id
      from unnest(v_requested_employee_ids) as employee_id;
    end if;

    if p_operator_employee_id is not null then
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
    end if;

    v_created_count := v_created_count + 1;
    v_date := v_date + 1;
  end loop;

  return v_created_count;
end;
$$;

create or replace function public.get_employee_schedule_browser(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
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

  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date - p_start_date > 31 then
    raise exception using message = 'INVALID_DATE_RANGE';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', schedule.id,
          'booth_id', schedule.booth_id,
          'date', schedule.date,
          'start_time', schedule.start_time,
          'end_time', schedule.end_time,
          'status', schedule.status,
          'created_at', schedule.created_at,
          'operator_employee_id', schedule.operator_employee_id,
          'booth_name', booth.name,
          'booth_location_text', booth.location_text,
          'operator_name', operator.name,
          'assigned_employee_names', to_jsonb(coalesce(assignment_names.names, array[]::text[])),
          'is_assigned', exists (
            select 1
            from public.booth_schedule_assignments as assignment
            where assignment.schedule_id = schedule.id
              and assignment.employee_id = v_employee_id
          )
        )
        order by schedule.date, schedule.start_time, schedule.created_at
      )
      from public.booth_schedules as schedule
      join public.booths as booth
        on booth.id = schedule.booth_id
      left join public.employees as operator
        on operator.id = schedule.operator_employee_id
      left join lateral (
        select array_agg(employee.name order by employee.name) as names
        from public.booth_schedule_assignments as assignment
        join public.employees as employee
          on employee.id = assignment.employee_id
        where assignment.schedule_id = schedule.id
      ) as assignment_names on true
      where schedule.date between p_start_date and p_end_date
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_employee_schedule_detail(
  p_schedule_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_schedule public.booth_schedules%rowtype;
  v_booth public.booths%rowtype;
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
  where id = p_schedule_id;

  if not found then
    return null;
  end if;

  select *
  into v_booth
  from public.booths
  where id = v_schedule.booth_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'schedule',
    to_jsonb(v_schedule) || jsonb_build_object(
      'booths',
      to_jsonb(v_booth),
      'booth_schedule_assignments',
      coalesce(
        (
          select jsonb_agg(to_jsonb(assignment) order by assignment.assigned_at, assignment.employee_id)
          from public.booth_schedule_assignments as assignment
          where assignment.schedule_id = v_schedule.id
        ),
        '[]'::jsonb
      ),
      'booth_schedule_operator_periods',
      coalesce(
        (
          select jsonb_agg(to_jsonb(period) order by period.starts_at, period.created_at)
          from public.booth_schedule_operator_periods as period
          where period.schedule_id = v_schedule.id
        ),
        '[]'::jsonb
      ),
      'shift_closeouts',
      coalesce(
        (
          select jsonb_agg(to_jsonb(closeout) order by closeout.closed_at desc, closeout.id desc)
          from public.shift_closeouts as closeout
          where closeout.schedule_id = v_schedule.id
        ),
        '[]'::jsonb
      )
    ),
    'products',
    coalesce(
      (
        select jsonb_agg(to_jsonb(product_row) order by product_row.name)
        from (
          select
            product.id,
            product.name,
            product.price,
            product.category,
            product.image_url,
            product.is_available,
            product.created_at,
            joint.quantity,
            joint.stock
          from public.booth_schedule_products as joint
          join public.products as product
            on product.id = joint.product_id
          where joint.schedule_id = v_schedule.id
        ) as product_row
      ),
      '[]'::jsonb
    ),
    'sales',
    coalesce(
      (
        select jsonb_agg(to_jsonb(sale_row) order by sale_row.created_at desc)
        from (
          select
            sale.id,
            sale.booth_id,
            sale.employee_id,
            sale.schedule_id,
            sale.total_amount,
            sale.payment_method,
            sale.receipt_photo_path,
            sale.status,
            sale.created_at,
            sale.updated_at,
            case
              when employee.id is null then null
              else jsonb_build_object('name', employee.name)
            end as employees,
            jsonb_build_object('name', booth.name) as booths
          from public.sales as sale
          left join public.employees as employee
            on employee.id = sale.employee_id
          left join public.booths as booth
            on booth.id = sale.booth_id
          where sale.schedule_id = v_schedule.id
            and sale.status = 'completed'
        ) as sale_row
      ),
      '[]'::jsonb
    ),
    'saleItems',
    coalesce(
      (
        select jsonb_agg(to_jsonb(item_row) order by item_row.id)
        from (
          select
            item.id,
            item.sale_id,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.subtotal,
            case
              when product.id is null then null
              else jsonb_build_object(
                'id', product.id,
                'name', product.name,
                'price', product.price,
                'category', product.category,
                'image_url', product.image_url,
                'is_available', product.is_available,
                'created_at', product.created_at
              )
            end as products
          from public.sale_items as item
          join public.sales as sale
            on sale.id = item.sale_id
          left join public.products as product
            on product.id = item.product_id
          where sale.schedule_id = v_schedule.id
            and sale.status = 'completed'
        ) as item_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.get_employee_schedule_sale_items(
  p_sale_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
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

  return coalesce(
    (
      select jsonb_agg(to_jsonb(item_row) order by item_row.id)
      from (
        select
          item.id,
          item.sale_id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.subtotal,
          case
            when product.id is null then null
            else jsonb_build_object(
              'id', product.id,
              'name', product.name,
              'price', product.price,
              'category', product.category,
              'image_url', product.image_url,
              'is_available', product.is_available,
              'created_at', product.created_at
            )
          end as products
        from public.sale_items as item
        join public.sales as sale
          on sale.id = item.sale_id
        left join public.products as product
          on product.id = item.product_id
        where item.sale_id = p_sale_id
          and sale.status = 'completed'
      ) as item_row
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.join_booth_schedule(p_schedule_id uuid)
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
    or v_schedule.date < timezone('Asia/Manila', now())::date
    or (
      v_schedule.date = timezone('Asia/Manila', now())::date
      and v_schedule.end_time <= timezone('Asia/Manila', now())::time
    ) then
    raise exception using message = 'SHIFT_NOT_JOINABLE';
  end if;

  if exists (
    select 1
    from public.booth_schedule_assignments
    where schedule_id = p_schedule_id
      and employee_id = v_employee_id
  ) then
    return p_schedule_id;
  end if;

  if exists (
    select 1
    from public.booth_schedule_assignments as assignment
    join public.booth_schedules as schedule
      on schedule.id = assignment.schedule_id
    where assignment.employee_id = v_employee_id
      and schedule.id <> p_schedule_id
      and schedule.status = 'scheduled'
      and schedule.date = v_schedule.date
      and schedule.start_time < v_schedule.end_time
      and schedule.end_time > v_schedule.start_time
  ) then
    raise exception using message = 'SCHEDULE_CONFLICT';
  end if;

  insert into public.booth_schedule_assignments (schedule_id, employee_id)
  values (p_schedule_id, v_employee_id);

  return p_schedule_id;
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
    update public.booth_schedule_operator_periods
    set starts_at = least(starts_at, now())
    where schedule_id = p_schedule_id
      and operator_employee_id = v_employee_id
      and ends_at is null;

    if not found then
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
    end if;

    return p_schedule_id;
  end if;

  delete from public.booth_schedule_operator_periods
  where schedule_id = p_schedule_id
    and ends_at is null
    and starts_at > now();

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
    select 1
    from public.sales
    where sales.schedule_id = schedule.id
      and sales.status = 'completed'
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
  v_employee_role text;
  v_line record;
  v_existing_stock integer;
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
      and schedule.end_time > timezone('Asia/Manila', p_occurred_at)::time
      and (
        schedule.start_time <= timezone('Asia/Manila', p_occurred_at)::time
        or exists (
          select 1
          from public.booth_schedule_products
          where booth_schedule_products.schedule_id = schedule.id
        )
        or p_event_type = 'opening'
      )
      and (
        v_employee_role = 'admin'
        or exists (
          select 1
          from public.booth_schedule_operator_periods as period
          where period.schedule_id = schedule.id
            and period.operator_employee_id = v_employee_id
            and period.starts_at <= p_occurred_at
            and (period.ends_at is null or period.ends_at > p_occurred_at)
        )
        or (
          p_event_type = 'opening'
          and schedule.operator_employee_id = v_employee_id
        )
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

  if p_event_type = 'opening' then
    update public.booth_schedule_operator_periods
    set starts_at = least(starts_at, p_occurred_at)
    where schedule_id = p_schedule_id
      and operator_employee_id = v_employee_id
      and ends_at is null;
  end if;

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
  v_cash_deductions_total numeric(10,2) := 0;
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

  select count(*)
  into v_inventory_row_count
  from public.booth_schedule_products
  where schedule_id = p_schedule_id;

  if v_schedule.status <> 'scheduled'
    or v_schedule.date > timezone('Asia/Manila', v_now)::date
    or (
      v_schedule.date = timezone('Asia/Manila', v_now)::date
      and v_schedule.start_time > timezone('Asia/Manila', v_now)::time
      and v_inventory_row_count = 0
    ) then
    raise exception using message = 'SHIFT_NOT_ACTIVE_FOR_CLOSEOUT';
  end if;

  if v_employee_role <> 'admin'
    and (
      v_schedule.operator_employee_id is null
      or v_schedule.operator_employee_id <> v_employee_id
    ) then
    raise exception using message = 'EMPLOYEE_NOT_OPERATOR';
  end if;

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

  select coalesce(sum(cash_rows.amount), 0)::numeric(10,2)
  into v_system_cash_sales
  from (
    select payment.amount
    from public.sales as sale
    join public.sale_payments as payment
      on payment.sale_id = sale.id
    where sale.schedule_id = p_schedule_id
      and sale.status = 'completed'
      and payment.payment_method = 'cash'

    union all

    select sale.total_amount as amount
    from public.sales as sale
    where sale.schedule_id = p_schedule_id
      and sale.status = 'completed'
      and sale.payment_method = 'cash'
      and not exists (
        select 1
        from public.sale_payments as payment
        where payment.sale_id = sale.id
      )
  ) as cash_rows;

  if exists (
    select 1
    from public.shift_action_approvals
    where schedule_id = p_schedule_id
      and action_type = 'cash_deduction'
      and status = 'pending'
  ) then
    raise exception using message = 'PENDING_CASH_DEDUCTIONS';
  end if;

  select coalesce(sum(nullif(payload ->> 'amount', '')::numeric), 0)::numeric(10,2)
  into v_cash_deductions_total
  from public.shift_action_approvals
  where schedule_id = p_schedule_id
    and action_type = 'cash_deduction'
    and status = 'approved';

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
    cash_deductions_total,
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
    v_cash_deductions_total,
    (
      p_counted_cash_sales::numeric(10,2)
      - (v_system_cash_sales - v_cash_deductions_total)
    )::numeric(10,2),
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

create or replace function public.cancel_booth_schedule(
  p_schedule_id uuid,
  p_current_date date,
  p_current_time time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.booth_schedules%rowtype;
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

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

  if v_schedule.date < p_current_date
    or (
      v_schedule.date = p_current_date
      and v_schedule.end_time <= p_current_time
    ) then
    raise exception using message = 'SHIFT_ALREADY_PASSED';
  end if;

  update public.booth_schedules
  set status = 'cancelled'
  where id = p_schedule_id;

  return p_schedule_id;
end;
$$;

create or replace function public.delete_booth_schedule_cascade(
  p_schedule_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.booth_schedules%rowtype;
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  delete from public.sales
  where schedule_id = p_schedule_id;

  delete from public.booth_schedules
  where id = p_schedule_id;

  return v_schedule.id;
end;
$$;

create or replace function public.request_shift_action_approval(
  p_schedule_id uuid,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_existing_id uuid;
  v_schedule public.booth_schedules%rowtype;
  v_promo_id text;
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

  if p_action_type not in ('reopen_shift', 'apply_promo') then
    raise exception using message = 'INVALID_APPROVAL_ACTION';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  if p_action_type = 'reopen_shift' then
    if v_schedule.status <> 'closed' then
      raise exception using message = 'SHIFT_NOT_CLOSED';
    end if;

    if not exists (
      select 1
      from public.booth_schedule_assignments
      where schedule_id = p_schedule_id
        and employee_id = v_employee_id
    ) and not public.current_employee_is_admin() then
      raise exception using message = 'EMPLOYEE_NOT_ASSIGNED';
    end if;

    select id
    into v_existing_id
    from public.shift_action_approvals
    where schedule_id = p_schedule_id
      and action_type = p_action_type
      and status = 'pending'
    order by created_at desc
    limit 1
    for update;
  else
    v_promo_id := nullif(coalesce(p_payload ->> 'promo_id', ''), '');

    if v_promo_id is null then
      raise exception using message = 'INVALID_PROMO';
    end if;

    if v_schedule.status <> 'scheduled' then
      raise exception using message = 'INVALID_ACTIVE_SCHEDULE';
    end if;

    if not public.current_employee_is_admin()
      and not exists (
        select 1
        from public.booth_schedule_operator_periods as period
        where period.schedule_id = p_schedule_id
          and period.operator_employee_id = v_employee_id
          and period.starts_at <= now()
          and (period.ends_at is null or period.ends_at > now())
      ) then
      raise exception using message = 'PROMO_APPROVAL_NOT_ALLOWED';
    end if;

    select id
    into v_existing_id
    from public.shift_action_approvals
    where schedule_id = p_schedule_id
      and requested_by_employee_id = v_employee_id
      and action_type = p_action_type
      and status = 'pending'
      and payload ->> 'promo_id' = v_promo_id
    order by created_at desc
    limit 1
    for update;
  end if;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.shift_action_approvals (
    schedule_id,
    requested_by_employee_id,
    action_type,
    payload
  )
  values (
    p_schedule_id,
    v_employee_id,
    p_action_type,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_existing_id;

  return v_existing_id;
end;
$$;

create or replace function public.request_shift_cash_deduction(
  p_schedule_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_schedule public.booth_schedules%rowtype;
  v_approval_id uuid;
begin
  select *
  into v_employee
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee.id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception using message = 'INVALID_CASH_DEDUCTION_AMOUNT';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception using message = 'CASH_DEDUCTION_REASON_REQUIRED';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  if v_schedule.status <> 'scheduled' then
    raise exception using message = 'SHIFT_NOT_OPEN';
  end if;

  if v_employee.role <> 'admin'
    and (
      v_schedule.operator_employee_id is null
      or v_schedule.operator_employee_id <> v_employee.id
    ) then
    raise exception using message = 'CASH_DEDUCTION_NOT_ALLOWED';
  end if;

  insert into public.shift_action_approvals (
    schedule_id,
    requested_by_employee_id,
    action_type,
    payload
  )
  values (
    p_schedule_id,
    v_employee.id,
    'cash_deduction',
    jsonb_build_object(
      'amount',
      round(p_amount::numeric, 2)::numeric(10,2),
      'reason',
      btrim(p_reason)
    )
  )
  returning id into v_approval_id;

  return v_approval_id;
end;
$$;

create or replace function public.get_pending_shift_action_approvals(
  p_schedule_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', approval.id,
          'schedule_id', approval.schedule_id,
          'requested_by_employee_id', approval.requested_by_employee_id,
          'requested_by_name', requester.name,
          'action_type', approval.action_type,
          'payload', approval.payload,
          'status', approval.status,
          'created_at', approval.created_at
        )
        order by approval.created_at desc
      )
      from public.shift_action_approvals as approval
      left join public.employees as requester
        on requester.id = approval.requested_by_employee_id
      where approval.status = 'pending'
        and (p_schedule_id is null or approval.schedule_id = p_schedule_id)
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.apply_sale_change_from_payload(
  p_sale_id uuid,
  p_action_type text,
  p_payload jsonb,
  p_actor_employee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_expected_updated_at timestamptz;
  v_now timestamptz := now();
  v_payment_method text;
  v_receipt_photo_path text;
  v_total_amount numeric(10,2) := 0;
  v_reason text;
  v_delta_row_count integer := 0;
  v_locked_row_count integer := 0;
  v_event_id uuid;
  v_delta record;
begin
  if p_action_type not in ('edit_sale', 'delete_sale') then
    raise exception using message = 'INVALID_SALE_ACTION';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception using message = 'SALE_NOT_FOUND';
  end if;

  if v_sale.status <> 'completed' then
    raise exception using message = 'SALE_NOT_EDITABLE';
  end if;

  if nullif(coalesce(p_payload ->> 'sale_updated_at', ''), '') is null then
    raise exception using message = 'SALE_SNAPSHOT_REQUIRED';
  end if;

  v_expected_updated_at := (p_payload ->> 'sale_updated_at')::timestamptz;

  if v_sale.updated_at <> v_expected_updated_at then
    raise exception using message = 'SALE_CHANGE_STALE';
  end if;

  v_reason := nullif(btrim(coalesce(p_payload ->> 'reason', '')), '');

  delete from public.sale_payments
  where sale_id = p_sale_id;

  insert into public.sale_payments (
    sale_id,
    payment_method,
    amount
  )
  values (
    p_sale_id,
    v_payment_method,
    v_total_amount::numeric(10,2)
  );

  if p_action_type = 'edit_sale' then
    if p_payload -> 'items' is null
      or jsonb_typeof(p_payload -> 'items') <> 'array'
      or jsonb_array_length(p_payload -> 'items') = 0 then
      raise exception using message = 'SALE_ITEMS_REQUIRED';
    end if;

    v_payment_method := coalesce(
      nullif(p_payload ->> 'payment_method', ''),
      v_sale.payment_method
    );

    if v_payment_method not in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other') then
      raise exception using message = 'INVALID_PAYMENT_METHOD';
    end if;

    if p_payload ? 'receipt_photo_path' then
      v_receipt_photo_path := nullif(p_payload ->> 'receipt_photo_path', '');
    else
      v_receipt_photo_path := v_sale.receipt_photo_path;
    end if;

    if v_payment_method <> 'cash' and v_receipt_photo_path is null then
      raise exception using message = 'RECEIPT_PHOTO_REQUIRED';
    end if;

    if v_receipt_photo_path is not null
      and not exists (
        select 1
        from storage.objects
        where bucket_id = 'receipts'
          and name = v_receipt_photo_path
      ) then
      raise exception using message = 'RECEIPT_PHOTO_NOT_FOUND';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_payload -> 'items')
        as item(product_id uuid, quantity integer, unit_price numeric)
      left join public.products on products.id = item.product_id
      where item.product_id is null
        or item.quantity is null
        or item.quantity <= 0
        or item.unit_price is null
        or item.unit_price < 0
        or products.id is null
    ) then
      raise exception using message = 'INVALID_SALE_ITEMS';
    end if;

    if (
      select count(*) <> count(distinct item.product_id)
      from jsonb_to_recordset(p_payload -> 'items')
        as item(product_id uuid, quantity integer, unit_price numeric)
    ) then
      raise exception using message = 'DUPLICATE_SALE_ITEMS';
    end if;

    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2)
    into v_total_amount
    from jsonb_to_recordset(p_payload -> 'items')
      as item(product_id uuid, quantity integer, unit_price numeric);

    select count(*)
    into v_delta_row_count
    from (
      with requested as (
        select item.product_id, item.quantity
        from jsonb_to_recordset(p_payload -> 'items')
          as item(product_id uuid, quantity integer, unit_price numeric)
      ),
      existing as (
        select item.product_id, item.quantity
        from public.sale_items as item
        where item.sale_id = p_sale_id
      ),
      deltas as (
        select
          coalesce(requested.product_id, existing.product_id) as product_id,
          coalesce(existing.quantity, 0) as previous_quantity,
          coalesce(requested.quantity, 0) as next_quantity
        from requested
        full join existing
          on existing.product_id = requested.product_id
      )
      select 1
      from deltas
    ) as delta_rows;

    for v_delta in
      with requested as (
        select item.product_id, item.quantity
        from jsonb_to_recordset(p_payload -> 'items')
          as item(product_id uuid, quantity integer, unit_price numeric)
      ),
      existing as (
        select item.product_id, item.quantity
        from public.sale_items as item
        where item.sale_id = p_sale_id
      ),
      deltas as (
        select
          coalesce(requested.product_id, existing.product_id) as product_id,
          coalesce(existing.quantity, 0) as previous_quantity,
          coalesce(requested.quantity, 0) as next_quantity
        from requested
        full join existing
          on existing.product_id = requested.product_id
      )
      select
        inventory.product_id,
        inventory.stock as previous_stock,
        inventory.stock - (deltas.next_quantity - deltas.previous_quantity) as resulting_stock
      from deltas
      join public.booth_schedule_products as inventory
        on inventory.schedule_id = v_sale.schedule_id
       and inventory.product_id = deltas.product_id
      order by inventory.product_id
      for update of inventory
    loop
      v_locked_row_count := v_locked_row_count + 1;

      if v_delta.resulting_stock < 0 then
        raise exception using message = 'INVENTORY_STALE';
      end if;

      if v_delta.previous_stock <> v_delta.resulting_stock then
        if v_event_id is null then
          insert into public.inventory_events (
            schedule_id,
            actor_employee_id,
            event_type,
            reason,
            occurred_at
          )
          values (
            v_sale.schedule_id,
            p_actor_employee_id,
            'admin_override',
            coalesce(v_reason, 'Sale updated') || ' [sale ' || left(p_sale_id::text, 8) || ']',
            v_now
          )
          returning id into v_event_id;
        end if;

        update public.booth_schedule_products
        set stock = v_delta.resulting_stock
        where schedule_id = v_sale.schedule_id
          and product_id = v_delta.product_id;

        insert into public.inventory_event_lines (
          id,
          event_id,
          product_id,
          previous_stock,
          resulting_stock,
          delta
        )
        values (
          gen_random_uuid(),
          v_event_id,
          v_delta.product_id,
          v_delta.previous_stock,
          v_delta.resulting_stock,
          v_delta.resulting_stock - v_delta.previous_stock
        );
      end if;
    end loop;

    if v_locked_row_count <> v_delta_row_count then
      raise exception using message = 'INVENTORY_STALE';
    end if;

    update public.sales
    set total_amount = v_total_amount,
        payment_method = v_payment_method,
        receipt_photo_path = v_receipt_photo_path,
        promo_id = null,
        promo_name = null,
        promo_type = null,
        promo_discount_total = 0,
        promo_approval_id = null,
        updated_at = v_now
    where id = p_sale_id;

    delete from public.sale_promos
    where sale_id = p_sale_id;

    delete from public.sale_items
    where sale_id = p_sale_id;

    insert into public.sale_items (
      id,
      sale_id,
      product_id,
      quantity,
      base_unit_price,
      discount_amount,
      unit_price,
      subtotal
    )
    select
      gen_random_uuid(),
      p_sale_id,
      item.product_id,
      item.quantity,
      item.unit_price,
      0,
      item.unit_price,
      (item.quantity * item.unit_price)::numeric(10,2)
    from jsonb_to_recordset(p_payload -> 'items')
      as item(product_id uuid, quantity integer, unit_price numeric);
  else
    select count(*)
    into v_delta_row_count
    from public.sale_items
    where sale_id = p_sale_id;

    for v_delta in
      select
        inventory.product_id,
        inventory.stock as previous_stock,
        inventory.stock + item.quantity as resulting_stock
      from public.sale_items as item
      join public.booth_schedule_products as inventory
        on inventory.schedule_id = v_sale.schedule_id
       and inventory.product_id = item.product_id
      where item.sale_id = p_sale_id
      order by inventory.product_id
      for update of inventory
    loop
      v_locked_row_count := v_locked_row_count + 1;

      if v_event_id is null then
        insert into public.inventory_events (
          schedule_id,
          actor_employee_id,
          event_type,
          reason,
          occurred_at
        )
        values (
          v_sale.schedule_id,
          p_actor_employee_id,
          'admin_override',
          coalesce(v_reason, 'Sale deleted') || ' [sale ' || left(p_sale_id::text, 8) || ']',
          v_now
        )
        returning id into v_event_id;
      end if;

      update public.booth_schedule_products
      set stock = v_delta.resulting_stock
      where schedule_id = v_sale.schedule_id
        and product_id = v_delta.product_id;

      insert into public.inventory_event_lines (
        id,
        event_id,
        product_id,
        previous_stock,
        resulting_stock,
        delta
      )
      values (
        gen_random_uuid(),
        v_event_id,
        v_delta.product_id,
        v_delta.previous_stock,
        v_delta.resulting_stock,
        v_delta.resulting_stock - v_delta.previous_stock
      );
    end loop;

    if v_locked_row_count <> v_delta_row_count then
      raise exception using message = 'INVENTORY_STALE';
    end if;

    update public.sales
    set status = 'deleted',
        updated_at = v_now
    where id = p_sale_id;

    delete from public.sale_promos
    where sale_id = p_sale_id;
  end if;

  return v_sale.schedule_id;
end;
$$;

create or replace function public.submit_sale_change(
  p_sale_id uuid,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_sale public.sales%rowtype;
  v_schedule public.booth_schedules%rowtype;
  v_existing_approval_id uuid;
  v_approval_id uuid;
  v_now timestamptz := now();
  v_payment_method text;
  v_receipt_photo_path text;
  v_new_total numeric(10,2) := 0;
  v_normalized_payload jsonb;
begin
  select *
  into v_employee
  from public.employees
  where employees.user_id = (select auth.uid())
    and employees.is_active is true
  limit 1;

  if v_employee.id is null then
    raise exception using message = 'EMPLOYEE_NOT_AUTHORIZED';
  end if;

  if p_action_type not in ('edit_sale', 'delete_sale') then
    raise exception using message = 'INVALID_SALE_ACTION';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception using message = 'SALE_NOT_FOUND';
  end if;

  if v_sale.status <> 'completed' then
    raise exception using message = 'SALE_NOT_EDITABLE';
  end if;

  select *
  into v_schedule
  from public.booth_schedules
  where id = v_sale.schedule_id;

  if not found then
    raise exception using message = 'SCHEDULE_NOT_FOUND';
  end if;

  if v_employee.role <> 'admin'
    and v_schedule.operator_employee_id <> v_employee.id then
    raise exception using message = 'SALE_CHANGE_NOT_ALLOWED';
  end if;

  select id
  into v_existing_approval_id
  from public.shift_action_approvals
  where status = 'pending'
    and action_type in ('edit_sale', 'delete_sale')
    and payload ->> 'sale_id' = p_sale_id::text
  order by created_at desc
  limit 1
  for update;

  if v_existing_approval_id is not null then
    return jsonb_build_object(
      'approval_id', v_existing_approval_id,
      'schedule_id', v_sale.schedule_id,
      'status', 'pending'
    );
  end if;

  if p_action_type = 'edit_sale' then
    if p_payload -> 'items' is null
      or jsonb_typeof(p_payload -> 'items') <> 'array'
      or jsonb_array_length(p_payload -> 'items') = 0 then
      raise exception using message = 'SALE_ITEMS_REQUIRED';
    end if;

    v_payment_method := coalesce(
      nullif(p_payload ->> 'payment_method', ''),
      v_sale.payment_method
    );

    if v_payment_method not in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other') then
      raise exception using message = 'INVALID_PAYMENT_METHOD';
    end if;

    if p_payload ? 'receipt_photo_path' then
      v_receipt_photo_path := nullif(p_payload ->> 'receipt_photo_path', '');
    else
      v_receipt_photo_path := v_sale.receipt_photo_path;
    end if;

    if v_payment_method <> 'cash' and v_receipt_photo_path is null then
      raise exception using message = 'RECEIPT_PHOTO_REQUIRED';
    end if;

    if v_receipt_photo_path is not null
      and not exists (
        select 1
        from storage.objects
        where bucket_id = 'receipts'
          and name = v_receipt_photo_path
      ) then
      raise exception using message = 'RECEIPT_PHOTO_NOT_FOUND';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_payload -> 'items')
        as item(product_id uuid, quantity integer, unit_price numeric)
      left join public.products on products.id = item.product_id
      where item.product_id is null
        or item.quantity is null
        or item.quantity <= 0
        or item.unit_price is null
        or item.unit_price < 0
        or products.id is null
    ) then
      raise exception using message = 'INVALID_SALE_ITEMS';
    end if;

    if (
      select count(*) <> count(distinct item.product_id)
      from jsonb_to_recordset(p_payload -> 'items')
        as item(product_id uuid, quantity integer, unit_price numeric)
    ) then
      raise exception using message = 'DUPLICATE_SALE_ITEMS';
    end if;

    select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2)
    into v_new_total
    from jsonb_to_recordset(p_payload -> 'items')
      as item(product_id uuid, quantity integer, unit_price numeric);

    v_normalized_payload := jsonb_build_object(
      'sale_id', v_sale.id,
      'sale_created_at', v_sale.created_at,
      'sale_updated_at', v_sale.updated_at,
      'previous_total_amount', v_sale.total_amount,
      'new_total_amount', v_new_total,
      'revenue_delta', v_new_total - v_sale.total_amount,
      'previous_payment_method', v_sale.payment_method,
      'payment_method', v_payment_method,
      'receipt_photo_path', v_receipt_photo_path,
      'reason', nullif(btrim(coalesce(p_payload ->> 'reason', '')), ''),
      'items',
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_id', item.product_id,
            'quantity', item.quantity,
            'unit_price', item.unit_price
          )
          order by item.product_id
        )
        from jsonb_to_recordset(p_payload -> 'items')
          as item(product_id uuid, quantity integer, unit_price numeric)
      )
    );
  else
    v_normalized_payload := jsonb_build_object(
      'sale_id', v_sale.id,
      'sale_created_at', v_sale.created_at,
      'sale_updated_at', v_sale.updated_at,
      'previous_total_amount', v_sale.total_amount,
      'new_total_amount', 0,
      'revenue_delta', 0 - v_sale.total_amount,
      'previous_payment_method', v_sale.payment_method,
      'payment_method', v_sale.payment_method,
      'receipt_photo_path', v_sale.receipt_photo_path,
      'reason', nullif(btrim(coalesce(p_payload ->> 'reason', '')), '')
    );
  end if;

  if v_employee.role = 'admin' then
    perform public.apply_sale_change_from_payload(
      v_sale.id,
      p_action_type,
      v_normalized_payload,
      v_employee.id
    );

    insert into public.shift_action_approvals (
      schedule_id,
      requested_by_employee_id,
      action_type,
      payload,
      status,
      resolved_by_employee_id,
      resolved_at,
      created_at,
      updated_at
    )
    values (
      v_sale.schedule_id,
      v_employee.id,
      p_action_type,
      v_normalized_payload,
      'approved',
      v_employee.id,
      v_now,
      v_now,
      v_now
    )
    returning id into v_approval_id;

    return jsonb_build_object(
      'approval_id', v_approval_id,
      'schedule_id', v_sale.schedule_id,
      'status', 'applied'
    );
  end if;

  insert into public.shift_action_approvals (
    schedule_id,
    requested_by_employee_id,
    action_type,
    payload
  )
  values (
    v_sale.schedule_id,
    v_employee.id,
    p_action_type,
    v_normalized_payload
  )
  returning id into v_approval_id;

  return jsonb_build_object(
    'approval_id', v_approval_id,
    'schedule_id', v_sale.schedule_id,
    'status', 'pending'
  );
end;
$$;

create or replace function public.resolve_shift_action_approval(
  p_approval_id uuid,
  p_decision text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_request public.shift_action_approvals%rowtype;
  v_schedule public.booth_schedules%rowtype;
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

  if p_decision not in ('approved', 'rejected') then
    raise exception using message = 'INVALID_APPROVAL_DECISION';
  end if;

  select *
  into v_request
  from public.shift_action_approvals
  where id = p_approval_id
  for update;

  if not found then
    raise exception using message = 'APPROVAL_NOT_FOUND';
  end if;

  if v_request.status <> 'pending' then
    raise exception using message = 'APPROVAL_ALREADY_RESOLVED';
  end if;

  if p_decision = 'approved' then
    if v_request.action_type = 'reopen_shift' then
      perform public.reopen_shift(
        v_request.schedule_id,
        'Approved reopen request.'
      );
    elsif v_request.action_type = 'cash_deduction' then
      select *
      into v_schedule
      from public.booth_schedules
      where id = v_request.schedule_id
      for update;

      if not found then
        raise exception using message = 'SCHEDULE_NOT_FOUND';
      end if;

      if v_schedule.status <> 'scheduled' then
        raise exception using message = 'SHIFT_NOT_OPEN';
      end if;
    elsif v_request.action_type in ('edit_sale', 'delete_sale') then
      perform public.apply_sale_change_from_payload(
        (v_request.payload ->> 'sale_id')::uuid,
        v_request.action_type,
        v_request.payload,
        v_employee_id
      );
    elsif v_request.action_type = 'apply_promo' then
      null;
    end if;
  end if;

  update public.shift_action_approvals
  set status = p_decision,
      resolved_by_employee_id = v_employee_id,
      resolved_at = v_now,
      updated_at = v_now
  where id = p_approval_id;

  return v_request.schedule_id;
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

  if v_schedule.operator_employee_id is not null then
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
  end if;

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

create or replace function public.delete_booth_cascade(
  p_booth_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_count integer := 0;
  v_sale_count integer := 0;
begin
  if not public.current_employee_is_admin() then
    raise exception using message = 'ADMIN_NOT_AUTHORIZED';
  end if;

  perform 1
  from public.booths
  where id = p_booth_id
  for update;

  if not found then
    raise exception using message = 'BOOTH_NOT_FOUND';
  end if;

  select count(*)::integer
  into v_schedule_count
  from public.booth_schedules
  where booth_id = p_booth_id;

  select count(*)::integer
  into v_sale_count
  from public.sales
  where booth_id = p_booth_id;

  delete from public.sales
  where booth_id = p_booth_id;

  delete from public.booth_schedules
  where booth_id = p_booth_id;

  delete from public.booths
  where id = p_booth_id;

  return jsonb_build_object(
    'booth_id',
    p_booth_id,
    'schedule_count',
    v_schedule_count,
    'sale_count',
    v_sale_count
  );
end;
$$;

drop function if exists public.finalize_pos_sale(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz,
  jsonb,
  uuid,
  text,
  text,
  numeric,
  uuid,
  jsonb
);

drop function if exists public.finalize_pos_sale(
  uuid,
  uuid,
  uuid,
  numeric,
  text,
  text,
  timestamptz,
  jsonb,
  uuid,
  text,
  text,
  numeric,
  uuid,
  jsonb,
  jsonb
);

create or replace function public.finalize_pos_sale(
  p_sale_id uuid,
  p_booth_id uuid,
  p_schedule_id uuid,
  p_total_amount numeric,
  p_payment_method text,
  p_receipt_photo_path text,
  p_created_at timestamptz,
  p_items jsonb,
  p_promo_id uuid default null,
  p_promo_name text default null,
  p_promo_type text default null,
  p_promo_discount_total numeric default 0,
  p_promo_approval_id uuid default null,
  p_promo_snapshot jsonb default null,
  p_payments jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
v_payments jsonb;
v_payment_total numeric(10,2);
v_has_non_cash_payment boolean := false;
  v_employee_id uuid;
  v_existing_employee_id uuid;
  v_is_admin boolean := false;
  v_expected_total numeric(10,2);
  v_expected_item_count integer;
  v_locked_item_count integer := 0;
  v_business_date date;
  v_promo public.promos%rowtype;
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

  select exists (
    select 1
    from public.employees
    where employees.id = v_employee_id
      and employees.role = 'admin'
  )
  into v_is_admin;

  if p_payment_method is null
    or p_payment_method not in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other') then
    raise exception using message = 'INVALID_PAYMENT_METHOD';
  end if;

  if p_receipt_photo_path is not null
    and p_receipt_photo_path not like (v_employee_id::text || '/%') then
    raise exception using message = 'INVALID_RECEIPT_PHOTO_PATH';
  end if;
  v_payments := coalesce(
    p_payments,
    jsonb_build_array(
      jsonb_build_object(
        'payment_method', p_payment_method,
        'amount', p_total_amount::numeric(10,2)
      )
    )
  );

  if v_payments is null
    or jsonb_typeof(v_payments) <> 'array'
    or jsonb_array_length(v_payments) = 0 then
    raise exception using message = 'SALE_PAYMENTS_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_payments)
      as payment(payment_method text, amount numeric)
    where payment.payment_method is null
      or payment.payment_method not in ('cash', 'gcash', 'maya', 'maribank', 'unionbank', 'other')
      or payment.amount is null
      or payment.amount <= 0
  ) then
    raise exception using message = 'INVALID_SALE_PAYMENTS';
  end if;

  select coalesce(sum(payment.amount), 0)::numeric(10,2)
  into v_payment_total
  from jsonb_to_recordset(v_payments)
    as payment(payment_method text, amount numeric);

  if v_payment_total <> p_total_amount::numeric(10,2) then
    raise exception using message = 'SALE_PAYMENT_TOTAL_MISMATCH';
  end if;

  select exists (
    select 1
    from jsonb_to_recordset(v_payments)
      as payment(payment_method text, amount numeric)
    where payment.payment_method <> 'cash'
  )
  into v_has_non_cash_payment;

  if v_has_non_cash_payment and p_receipt_photo_path is null then
    raise exception using message = 'RECEIPT_PHOTO_REQUIRED';
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

  v_business_date := timezone('Asia/Manila', p_created_at)::date;

  if not exists (
    select 1
    from public.booth_schedules as schedule
    where schedule.id = p_schedule_id
      and schedule.booth_id = p_booth_id
      and schedule.status = 'scheduled'
      and schedule.date = v_business_date
      and schedule.end_time > timezone('Asia/Manila', p_created_at)::time
      and p_created_at <= now() + interval '5 minutes'
      and (
        schedule.start_time <= timezone('Asia/Manila', p_created_at)::time
        or exists (
          select 1
          from public.booth_schedule_products
          where booth_schedule_products.schedule_id = schedule.id
        )
      )
      and (
        v_is_admin
        or exists (
          select 1
          from public.booth_schedule_operator_periods as period
          where period.schedule_id = schedule.id
            and period.operator_employee_id = v_employee_id
            and period.starts_at <= p_created_at
            and (period.ends_at is null or period.ends_at > p_created_at)
        )
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
      as item(
        product_id uuid,
        quantity integer,
        unit_price numeric,
        expected_stock integer,
        base_unit_price numeric,
        discount_amount numeric
      )
    left join public.products on products.id = item.product_id
    where item.product_id is null
      or item.quantity is null
      or item.quantity <= 0
      or item.unit_price is null
      or item.unit_price < 0
      or item.expected_stock is null
      or item.expected_stock < 0
      or item.base_unit_price is null
      or item.base_unit_price < 0
      or item.discount_amount is null
      or item.discount_amount < 0
      or products.id is null
  ) then
    raise exception using message = 'INVALID_SALE_ITEMS';
  end if;

  if exists (
    select 1
    from (
      select item.product_id, sum(item.quantity) as quantity, max(item.expected_stock) as expected_stock
      from jsonb_to_recordset(p_items)
        as item(
          product_id uuid,
          quantity integer,
          unit_price numeric,
          expected_stock integer,
          base_unit_price numeric,
          discount_amount numeric
        )
      group by item.product_id
    ) as aggregated
    where aggregated.expected_stock < aggregated.quantity
  ) then
    raise exception using message = 'INVALID_SALE_ITEMS';
  end if;

  if p_promo_id is null then
    if coalesce(p_promo_discount_total, 0)::numeric(10,2) <> 0
      or p_promo_approval_id is not null then
      raise exception using message = 'INVALID_PROMO';
    end if;
  else
    select *
    into v_promo
    from public.promos
    where id = p_promo_id
      and is_active = true
      and starts_on <= v_business_date
      and ends_on >= v_business_date;

    if not found then
      raise exception using message = 'INVALID_PROMO';
    end if;

    if coalesce(p_promo_name, '') <> v_promo.name
      or coalesce(p_promo_type, '') <> v_promo.promo_type then
      raise exception using message = 'INVALID_PROMO';
    end if;

    if coalesce(p_promo_discount_total, 0)::numeric(10,2) <= 0 then
      raise exception using message = 'PROMO_NOT_ELIGIBLE';
    end if;

    if v_promo.requires_admin_approval and not v_is_admin then
      if p_promo_approval_id is null then
        raise exception using message = 'PROMO_APPROVAL_REQUIRED';
      end if;

      if exists (
        select 1
        from public.sale_promos
        where promo_approval_id = p_promo_approval_id
      ) then
        raise exception using message = 'PROMO_APPROVAL_USED';
      end if;

      if not exists (
        select 1
        from public.shift_action_approvals as approval
        where approval.id = p_promo_approval_id
          and approval.schedule_id = p_schedule_id
          and approval.requested_by_employee_id = v_employee_id
          and approval.action_type = 'apply_promo'
          and approval.status = 'approved'
          and approval.payload ->> 'promo_id' = p_promo_id::text
      ) then
        raise exception using message = 'PROMO_APPROVAL_REQUIRED';
      end if;
    end if;
  end if;

  select coalesce(sum(item.quantity * item.unit_price), 0)::numeric(10,2)
  into v_expected_total
  from jsonb_to_recordset(p_items)
    as item(
      product_id uuid,
      quantity integer,
      unit_price numeric,
      expected_stock integer,
      base_unit_price numeric,
      discount_amount numeric
    );

  select count(*)
  into v_expected_item_count
  from (
    select item.product_id
    from jsonb_to_recordset(p_items)
      as item(
        product_id uuid,
        quantity integer,
        unit_price numeric,
        expected_stock integer,
        base_unit_price numeric,
        discount_amount numeric
      )
    group by item.product_id
  ) as aggregated;

  if v_expected_total <> p_total_amount::numeric(10,2) then
    raise exception using message = 'SALE_TOTAL_MISMATCH';
  end if;

  for v_item in
    select
      aggregated.product_id,
      aggregated.quantity,
      aggregated.expected_stock,
      inventory.stock
    from public.booth_schedule_products as inventory
    join (
      select
        item.product_id,
        sum(item.quantity) as quantity,
        max(item.expected_stock) as expected_stock
      from jsonb_to_recordset(p_items)
        as item(
          product_id uuid,
          quantity integer,
          unit_price numeric,
          expected_stock integer,
          base_unit_price numeric,
          discount_amount numeric
        )
      group by item.product_id
    ) as aggregated
      on inventory.schedule_id = p_schedule_id
      and inventory.product_id = aggregated.product_id
    for update of inventory
  loop
    v_locked_item_count := v_locked_item_count + 1;

    if v_item.stock <> v_item.expected_stock then
      raise exception using message = 'INVENTORY_STALE';
    end if;

    if v_item.stock < v_item.quantity then
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
    promo_id,
    promo_name,
    promo_type,
    promo_discount_total,
    promo_approval_id,
    receipt_photo_path,
    status,
    created_at,
    updated_at
  )
  values (
    p_sale_id,
    p_booth_id,
    v_employee_id,
    p_schedule_id,
    p_total_amount,
    p_payment_method,
    p_promo_id,
    p_promo_name,
    p_promo_type,
    coalesce(p_promo_discount_total, 0)::numeric(10,2),
    p_promo_approval_id,
    p_receipt_photo_path,
    'completed',
    coalesce(p_created_at, now()),
    coalesce(p_created_at, now())
  );

  insert into public.sale_payments (
    sale_id,
    payment_method,
    amount
  )
  select
    p_sale_id,
    payment.payment_method,
    payment.amount::numeric(10,2)
  from jsonb_to_recordset(v_payments)
    as payment(payment_method text, amount numeric);

  if p_promo_id is not null then
    insert into public.sale_promos (
      sale_id,
      promo_id,
      promo_name,
      promo_type,
      discount_total,
      promo_approval_id,
      snapshot
    )
    values (
      p_sale_id,
      p_promo_id,
      p_promo_name,
      p_promo_type,
      coalesce(p_promo_discount_total, 0)::numeric(10,2),
      p_promo_approval_id,
      coalesce(p_promo_snapshot, '{}'::jsonb)
    );
  end if;

  insert into public.sale_items (
    id,
    sale_id,
    product_id,
    quantity,
    base_unit_price,
    discount_amount,
    unit_price,
    subtotal
  )
  select
    gen_random_uuid(),
    p_sale_id,
    item.product_id,
    item.quantity,
    item.base_unit_price,
    item.discount_amount,
    item.unit_price,
    (item.quantity * item.unit_price)::numeric(10,2)
  from jsonb_to_recordset(p_items)
    as item(
      product_id uuid,
      quantity integer,
      unit_price numeric,
      expected_stock integer,
      base_unit_price numeric,
      discount_amount numeric
    );

  update public.booth_schedule_products as inventory
  set stock = inventory.stock - aggregated.quantity
  from (
    select item.product_id, sum(item.quantity) as quantity
    from jsonb_to_recordset(p_items)
      as item(
        product_id uuid,
        quantity integer,
        unit_price numeric,
        expected_stock integer,
        base_unit_price numeric,
        discount_amount numeric
      )
    group by item.product_id
  ) as aggregated
  where inventory.schedule_id = p_schedule_id
    and inventory.product_id = aggregated.product_id;

  return p_sale_id;
end;
$$;

revoke execute on function public.save_booth_schedule(uuid, uuid, uuid[], uuid, date, time, time, date, time) from public;
revoke execute on function public.save_booth_schedule_range(uuid, uuid[], uuid, date, date, time, time, date, time) from public;
revoke execute on function public.get_employee_schedule_browser(date, date) from public;
revoke execute on function public.get_employee_schedule_detail(uuid) from public;
revoke execute on function public.get_employee_schedule_sale_items(uuid) from public;
revoke execute on function public.join_booth_schedule(uuid) from public;
revoke execute on function public.claim_shift_operator(uuid) from public;
revoke execute on function public.close_shift(uuid, numeric, jsonb) from public;
revoke execute on function public.cancel_booth_schedule(uuid, date, time) from public;
revoke execute on function public.delete_booth_schedule_cascade(uuid) from public;
revoke execute on function public.deactivate_booth_and_cancel_future_schedules(uuid, date, time) from public;
revoke execute on function public.delete_booth_cascade(uuid) from public;
revoke execute on function public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb, uuid, text, text, numeric, uuid, jsonb) from public;
revoke execute on function public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb, uuid, text, text, numeric, uuid, jsonb, jsonb) from public;
revoke execute on function public.record_shift_inventory_event(uuid, uuid, text, text, timestamptz, jsonb) from public;
revoke execute on function public.record_admin_inventory_override(uuid, uuid, text, jsonb) from public;
revoke execute on function public.apply_sale_change_from_payload(uuid, text, jsonb, uuid) from public;
revoke execute on function public.reopen_shift(uuid, text) from public;
revoke execute on function public.request_shift_action_approval(uuid, text, jsonb) from public;
revoke execute on function public.request_shift_cash_deduction(uuid, numeric, text) from public;
revoke execute on function public.get_pending_shift_action_approvals(uuid) from public;
revoke execute on function public.resolve_shift_action_approval(uuid, text) from public;
revoke execute on function public.submit_sale_change(uuid, text, jsonb) from public;
grant execute on function public.save_booth_schedule(uuid, uuid, uuid[], uuid, date, time, time, date, time) to authenticated;
grant execute on function public.save_booth_schedule_range(uuid, uuid[], uuid, date, date, time, time, date, time) to authenticated;
grant execute on function public.get_employee_schedule_browser(date, date) to authenticated;
grant execute on function public.get_employee_schedule_detail(uuid) to authenticated;
grant execute on function public.get_employee_schedule_sale_items(uuid) to authenticated;
grant execute on function public.join_booth_schedule(uuid) to authenticated;
grant execute on function public.claim_shift_operator(uuid) to authenticated;
grant execute on function public.close_shift(uuid, numeric, jsonb) to authenticated;
grant execute on function public.cancel_booth_schedule(uuid, date, time) to authenticated;
grant execute on function public.delete_booth_schedule_cascade(uuid) to authenticated;
grant execute on function public.deactivate_booth_and_cancel_future_schedules(uuid, date, time) to authenticated;
grant execute on function public.delete_booth_cascade(uuid) to authenticated;
grant execute on function public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb, uuid, text, text, numeric, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.record_shift_inventory_event(uuid, uuid, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.record_admin_inventory_override(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.reopen_shift(uuid, text) to authenticated;
grant execute on function public.request_shift_action_approval(uuid, text, jsonb) to authenticated;
grant execute on function public.request_shift_cash_deduction(uuid, numeric, text) to authenticated;
grant execute on function public.get_pending_shift_action_approvals(uuid) to authenticated;
grant execute on function public.resolve_shift_action_approval(uuid, text) to authenticated;
grant execute on function public.submit_sale_change(uuid, text, jsonb) to authenticated;

alter table public.booths enable row level security;
alter table public.employees enable row level security;
alter table public.booth_schedules enable row level security;
alter table public.booth_schedule_assignments enable row level security;
alter table public.booth_schedule_operator_periods enable row level security;
alter table public.products enable row level security;
alter table public.promos enable row level security;
alter table public.promo_products enable row level security;
alter table public.booth_schedule_products enable row level security;
alter table public.inventory_events enable row level security;
alter table public.inventory_event_lines enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_promos enable row level security;
alter table public.shift_closeouts enable row level security;
alter table public.shift_action_approvals enable row level security;
alter table public.sale_payments enable row level security;

drop policy if exists "admins read sale payments" on public.sale_payments;
create policy "admins read sale payments"
on public.sale_payments
for select
to authenticated
using ((select public.current_employee_is_admin()));

drop policy if exists "employees read assigned sale payments" on public.sale_payments;
create policy "employees read assigned sale payments"
on public.sale_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.sales as sale
    where sale.id = sale_payments.sale_id
      and public.current_employee_is_assigned(sale.schedule_id)
  )
);

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

drop policy if exists "admins manage promos" on public.promos;
create policy "admins manage promos"
on public.promos
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read promos" on public.promos;
create policy "employees read promos"
on public.promos
for select
to authenticated
using ((select public.current_employee_id()) is not null);

drop policy if exists "admins manage promo products" on public.promo_products;
create policy "admins manage promo products"
on public.promo_products
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read promo products" on public.promo_products;
create policy "employees read promo products"
on public.promo_products
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
      and sales.status = 'completed'
      and public.current_employee_is_assigned(sales.schedule_id)
  )
);

drop policy if exists "admins manage sale promos" on public.sale_promos;
create policy "admins manage sale promos"
on public.sale_promos
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read assigned sale promos" on public.sale_promos;
create policy "employees read assigned sale promos"
on public.sale_promos
for select
to authenticated
using (
  exists (
    select 1
    from public.sales
    where sales.id = sale_promos.sale_id
      and sales.status = 'completed'
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

drop policy if exists "admins manage shift action approvals" on public.shift_action_approvals;
create policy "admins manage shift action approvals"
on public.shift_action_approvals
for all
to authenticated
using ((select public.current_employee_is_admin()))
with check ((select public.current_employee_is_admin()));

drop policy if exists "employees read own shift action approvals" on public.shift_action_approvals;
create policy "employees read own shift action approvals"
on public.shift_action_approvals
for select
to authenticated
using (
  requested_by_employee_id = (select public.current_employee_id())
  or public.current_employee_is_assigned(schedule_id)
);

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
      and sales.status = 'completed'
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

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'public.sales',
    'public.products',
    'public.promos',
    'public.promo_products',
    'public.booth_schedule_products',
    'public.inventory_events',
    'public.booth_schedules',
    'public.booth_schedule_operator_periods',
    'public.booth_schedule_assignments'
  ] loop
    begin
      execute format(
        'alter publication supabase_realtime add table %s',
        realtime_table
      );
    exception
      when duplicate_object then null;
    end;
  end loop;
end
$$;
