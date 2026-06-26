-- Fix historical sale deletes after split-payment rollout.
--
-- The deployed version of apply_sale_change_from_payload was touching
-- sale_payments before branching on edit_sale vs delete_sale. That made
-- delete_sale try to insert a split-payment row with null payment_method and
-- 0.00 amount, which breaks legacy sales that existed before sale_payments.
--
-- Keep sale_payments mutation inside edit_sale only. delete_sale should only
-- restore inventory, mark the sale deleted, and clear promo metadata.

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

  if p_action_type = 'edit_sale' then
    if p_payload -> 'items' is null
      or jsonb_typeof(p_payload -> 'items') <> 'array'
      or jsonb_array_length(p_payload -> 'items') = 0 then
      raise exception using message = 'SALE_ITEMS_REQUIRED';
    end if;

    v_payment_method := coalesce(
      nullif(p_payload ->> 'payment_method', ''),
      v_sale.payment_method,
      'cash'
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

    delete from public.sale_payments
    where sale_id = p_sale_id;

    insert into public.sale_payments (
      sale_id,
      payment_method,
      amount,
      receipt_photo_path
    )
    values (
      p_sale_id,
      v_payment_method,
      v_total_amount::numeric(10,2),
      v_receipt_photo_path
    );

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

grant execute on function public.apply_sale_change_from_payload(uuid, text, jsonb, uuid) to authenticated;
