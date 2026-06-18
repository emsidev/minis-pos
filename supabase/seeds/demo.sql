-- Demo fixtures for Mini's Pastries POS.
-- These records include fixed historical reporting data and live setup examples.

BEGIN;

-- 1. Reference Existing Employee
-- Provided ID: 55970fb4-a756-421e-9ec1-f440ae5e1b49
-- Name: mc
-- Role: employee

-- 2. Seed Booths (Using valid hex UUIDs)
INSERT INTO public.booths (id, name, location_text, is_active)
VALUES 
  ('00000000-0000-0000-0001-000000000001', 'Main Branch - Kiosk A', 'Grand Mall Ground Floor', true),
  ('00000000-0000-0000-0001-000000000002', 'SM City North Booth', 'Near Event Center', true),
  ('00000000-0000-0000-0001-000000000003', 'Park View Pavilion', 'Central Park Food Court', true)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  location_text = EXCLUDED.location_text;

-- 3. Seed Products (Using valid hex UUIDs)
INSERT INTO public.products (id, name, price, category, image_url, is_available)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Cheesy Ensaymada', 45.00, 'Bread', 'https://images.unsplash.com/photo-1620921652119-14af0269d3c1', true),
  ('00000000-0000-0000-0000-000000000002', 'Spanish Bread', 35.00, 'Bread', 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec', true),
  ('00000000-0000-0000-0000-000000000003', 'Ube Cheese Pandesal', 40.00, 'Bread', 'https://images.unsplash.com/photo-1595121624649-eeb32a56245c', true),
  ('00000000-0000-0000-0000-000000000004', 'Chocolate Cake Slice', 120.00, 'Cakes', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587', true),
  ('00000000-0000-0000-0000-000000000005', 'Egg Pie Slice', 55.00, 'Pies', 'https://images.unsplash.com/photo-1619038480461-3b7e68341af8', true),
  ('00000000-0000-0000-0000-000000000006', 'Red Velvet Cupcake', 65.00, 'Cakes', 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7', true)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  category = EXCLUDED.category;

-- 4. Seed Booth Schedules (Using valid hex UUIDs)
-- Fixed demo date: 2026-04-12
INSERT INTO public.booth_schedules (id, booth_id, employee_id, date, start_time, end_time)
VALUES 
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '2026-04-12', '08:00:00', '16:00:00')
ON CONFLICT (id) DO NOTHING;

-- Fixed historical demo date: 2026-04-13
INSERT INTO public.booth_schedules (id, booth_id, employee_id, date, start_time, end_time)
VALUES 
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '2026-04-13', '10:00:00', '18:00:00')
ON CONFLICT (id) DO NOTHING;

-- Current and upcoming operational assignments intentionally have no opening
-- inventory. The assigned employee enters stock when the active shift begins.
INSERT INTO public.booth_schedules (id, booth_id, employee_id, date, start_time, end_time)
VALUES
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', '55970fb4-a756-421e-9ec1-f440ae5e1b49', timezone('Asia/Manila', now())::date, '00:00:00', '23:59:59'),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000002', '55970fb4-a756-421e-9ec1-f440ae5e1b49', timezone('Asia/Manila', now())::date + 1, '10:00:00', '18:00:00')
ON CONFLICT (id) DO UPDATE SET
  booth_id = EXCLUDED.booth_id,
  employee_id = EXCLUDED.employee_id,
  date = EXCLUDED.date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  status = 'scheduled';

-- 5. Seed Historical Booth Schedule Products (Inventory)
-- Historical stock remains available for schedule and sales-history examples.
INSERT INTO public.booth_schedule_products (schedule_id, product_id, quantity, stock)
SELECT '00000000-0000-0000-0002-000000000001', id, 20, 20 FROM public.products
ON CONFLICT (schedule_id, product_id) DO UPDATE SET 
  quantity = EXCLUDED.quantity,
  stock = EXCLUDED.stock;

INSERT INTO public.booth_schedule_products (schedule_id, product_id, quantity, stock)
SELECT '00000000-0000-0000-0002-000000000002', id, 25, 25 FROM public.products
ON CONFLICT (schedule_id, product_id) DO UPDATE SET 
  quantity = EXCLUDED.quantity,
  stock = EXCLUDED.stock;

-- 6. Seed Sample Sales
-- Yesterday's Sales
INSERT INTO public.sales (id, booth_id, employee_id, schedule_id, total_amount, payment_method, receipt_photo_path, created_at)
VALUES 
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '00000000-0000-0000-0002-000000000001', 125.00, 'cash', null, '2026-04-12 10:30:00+00'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '00000000-0000-0000-0002-000000000001', 80.00, 'gcash', '55970fb4-a756-421e-9ec1-f440ae5e1b49/demo-2026-04-12-gcash.jpg', '2026-04-12 14:15:00+00')
ON CONFLICT (id) DO NOTHING;

-- Sales Items for Yesterday
INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
VALUES 
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 1, 45.00, 45.00),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000002', 1, 35.00, 35.00),
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 1, 45.00, 45.00),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000003', 2, 40.00, 80.00)
ON CONFLICT DO NOTHING;

-- Historical 2026-04-13 Sales
INSERT INTO public.sales (id, booth_id, employee_id, schedule_id, total_amount, payment_method, receipt_photo_path, created_at)
VALUES 
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000002', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '00000000-0000-0000-0002-000000000002', 240.00, 'cash', null, '2026-04-13 11:00:00+00'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000002', '55970fb4-a756-421e-9ec1-f440ae5e1b49', '00000000-0000-0000-0002-000000000002', 175.00, 'gcash', '55970fb4-a756-421e-9ec1-f440ae5e1b49/demo-2026-04-13-gcash.jpg', '2026-04-13 15:45:00+00')
ON CONFLICT (id) DO NOTHING;

-- Sales Items for historical 2026-04-13 shift
INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
VALUES 
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000004', 2, 120.00, 240.00),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000006', 1, 65.00, 65.00),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000005', 2, 55.00, 110.00)
ON CONFLICT DO NOTHING;

COMMIT;
