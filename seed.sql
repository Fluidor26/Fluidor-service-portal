-- Demo-gegevens voor een test- of ontwikkelomgeving. NIET op productie draaien.
-- Klanten en projecten zijn fictief.

insert into public.customers (id, name, city, erp_number, contract) values
  ('11111111-1111-4111-8111-111111111111', 'Zuivelcoöperatie De Noordhoeve B.V.', 'Leeuwarden', 'D10421', 'service_maintenance_plan'),
  ('22222222-2222-4222-8222-222222222222', 'Van Dijk Bakery Ingredients', 'Veghel', 'D10388', 'service_maintenance_plan'),
  ('33333333-3333-4333-8333-333333333333', 'Agrimix Proteins B.V.', 'Oss', 'D10507', 'geen');

insert into public.locations (id, customer_id, name, address) values
  ('a1111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Fabriek Leeuwarden', 'Zuivelweg 12, Leeuwarden'),
  ('a2222222-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Vestiging Veghel', 'Bakkerstraat 4, Veghel'),
  ('a3333333-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'Productie Oss', 'Eiwitlaan 9, Oss');

insert into public.production_lines (id, customer_id, location_id, name, sort_order) values
  ('b1111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1111111-0000-4000-8000-000000000001', 'Poederlijn 2', 2),
  ('b1111111-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1111111-0000-4000-8000-000000000001', 'Grondstofontvangst', 1),
  ('b2222222-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'a2222222-0000-4000-8000-000000000001', 'Menglijn', 1),
  ('b3333333-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'a3333333-0000-4000-8000-000000000001', 'Zeeflijn', 1);

insert into public.machines (id, customer_id, location_id, line_id, project_number, serial_number, name, machine_type, delivered_on, contract_start, next_service_on) values
  ('c1111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1111111-0000-4000-8000-000000000001', 'b1111111-0000-4000-8000-000000000001',
   '612-FE-2022', 'FV-22-0612', 'FLUIVAC vacuümtransport poederlijn 2', 'Vacuümtransport', '2022-11-14', '2022-11-14', '2026-11-16'),
  ('c1111111-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a1111111-0000-4000-8000-000000000001', 'b1111111-0000-4000-8000-000000000002',
   '655-FE-2024', 'BB-24-0655', 'Big-bag losstation met doseerunit', 'Big-bag losstation', '2024-06-03', '2024-06-03', '2027-01-11'),
  ('c2222222-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'a2222222-0000-4000-8000-000000000001', 'b2222222-0000-4000-8000-000000000001',
   '680-FE-2025', 'FV-25-0680', 'FLUIVAC vacuümtransport bloemsilo-lijn', 'Vacuümtransport', '2025-12-08', '2025-12-08', '2026-12-08'),
  ('c3333333-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'a3333333-0000-4000-8000-000000000001', 'b3333333-0000-4000-8000-000000000001',
   '621-FE-2022', 'ZF-22-0621', 'Proteïnepoeder transport en zeefinstallatie', 'Zeefinstallatie', '2022-04-11', null, null);

insert into public.components (machine_id, article_number, description, quantity, is_spare_part) values
  ('c1111111-0000-4000-8000-000000000001', 'FL-VP-250', 'Vacuümpomp 250 m³/h', 1, false),
  ('c1111111-0000-4000-8000-000000000001', 'FL-FLT-0612', 'Filterpatroon ontvanger', 4, true),
  ('c1111111-0000-4000-8000-000000000001', 'FL-AFD-80', 'Afdichtingsset klep DN80', 2, true),
  ('c2222222-0000-4000-8000-000000000001', 'FL-FLT-0680', 'Filterpatroon ontvanger', 6, true),
  ('c3333333-0000-4000-8000-000000000001', 'FL-ZD-250', 'Zeefdoek 250 µm', 2, true);
