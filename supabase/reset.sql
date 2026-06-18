-- Development-only reset for the disposable Mini's Pastries POS database.
-- Run this before schema.sql and seeds/demo.sql when rebuilding test data.

drop policy if exists "employees upload own receipt photos" on storage.objects;
drop policy if exists "employees update own receipt photos" on storage.objects;
drop policy if exists "employees read own receipt photos" on storage.objects;
drop policy if exists "employees read assigned receipt photos" on storage.objects;
drop policy if exists "admins read receipt photos" on storage.objects;

delete from storage.objects where bucket_id = 'receipts';
delete from storage.buckets where id = 'receipts';

drop table if exists public.sale_items cascade;
drop table if exists public.sales cascade;
drop table if exists public.inventory_event_lines cascade;
drop table if exists public.inventory_events cascade;
drop table if exists public.booth_schedule_products cascade;
drop table if exists public.booth_schedule_operator_periods cascade;
drop table if exists public.booth_schedule_assignments cascade;
drop table if exists public.products cascade;
drop table if exists public.booth_schedules cascade;
drop table if exists public.booths cascade;
drop table if exists public.employees cascade;

drop function if exists public.finalize_pos_sale(uuid, uuid, uuid, numeric, text, text, timestamptz, jsonb) cascade;
drop function if exists public.save_booth_schedule_with_inventory(uuid, uuid, uuid, date, time, time, jsonb, date, time) cascade;
drop function if exists public.save_booth_schedule(uuid, uuid, uuid, date, time, time, date, time) cascade;
drop function if exists public.save_booth_schedule(uuid, uuid, uuid[], uuid, date, time, time, date, time) cascade;
drop function if exists public.save_booth_schedule_range(uuid, uuid[], uuid, date, date, time, time, date, time) cascade;
drop function if exists public.claim_shift_operator(uuid) cascade;
drop function if exists public.record_shift_inventory_event(uuid, uuid, text, text, timestamptz, jsonb) cascade;
drop function if exists public.record_admin_inventory_override(uuid, uuid, text, jsonb) cascade;
drop function if exists public.deactivate_booth_and_cancel_future_schedules(uuid, date, time) cascade;
drop function if exists public.current_employee_id() cascade;
drop function if exists public.current_employee_is_admin() cascade;
drop function if exists public.current_employee_is_assigned(uuid) cascade;
