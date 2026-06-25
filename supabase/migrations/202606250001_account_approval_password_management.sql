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
