create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  gender text,
  birth_date date,
  driving_distance numeric,
  distance_period text not null default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_gender_check check (gender is null or gender in ('Masculino', 'Femenino', 'Otro')),
  constraint profiles_distance_period_check check (distance_period in ('daily', 'monthly')),
  constraint profiles_driving_distance_check check (driving_distance is null or driving_distance >= 0)
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists driving_distance numeric;
alter table public.profiles add column if not exists distance_period text not null default 'daily';

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles drop constraint if exists profiles_distance_period_check;
alter table public.profiles drop constraint if exists profiles_driving_distance_check;

alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('Masculino', 'Femenino', 'Otro'));
alter table public.profiles add constraint profiles_distance_period_check check (distance_period in ('daily', 'monthly'));
alter table public.profiles add constraint profiles_driving_distance_check check (driving_distance is null or driving_distance >= 0);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  plate text,
  vin text not null,
  make text not null,
  model_line text not null,
  model_year integer,
  engine text not null,
  usage text,
  vehicle_type text,
  seats integer,
  color text,
  cylinders integer,
  cc integer,
  current_mileage integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_vin_length check (char_length(vin) between 6 and 17),
  constraint vehicles_model_year_check check (model_year is null or model_year between 1900 and 2100),
  constraint vehicles_seats_check check (seats is null or seats >= 1),
  constraint vehicles_cylinders_check check (cylinders is null or cylinders >= 1),
  constraint vehicles_cc_check check (cc is null or cc >= 1),
  constraint vehicles_current_mileage_check check (current_mileage is null or current_mileage >= 0)
);

alter table public.vehicles add column if not exists plate text;
alter table public.vehicles add column if not exists model_year integer;
alter table public.vehicles add column if not exists usage text;
alter table public.vehicles add column if not exists vehicle_type text;
alter table public.vehicles add column if not exists seats integer;
alter table public.vehicles add column if not exists color text;
alter table public.vehicles add column if not exists cylinders integer;
alter table public.vehicles add column if not exists cc integer;
alter table public.vehicles add column if not exists current_mileage integer;

alter table public.vehicles drop constraint if exists vehicles_model_year_check;
alter table public.vehicles drop constraint if exists vehicles_seats_check;
alter table public.vehicles drop constraint if exists vehicles_cylinders_check;
alter table public.vehicles drop constraint if exists vehicles_cc_check;
alter table public.vehicles drop constraint if exists vehicles_current_mileage_check;

alter table public.vehicles add constraint vehicles_model_year_check check (model_year is null or model_year between 1900 and 2100);
alter table public.vehicles add constraint vehicles_seats_check check (seats is null or seats >= 1);
alter table public.vehicles add constraint vehicles_cylinders_check check (cylinders is null or cylinders >= 1);
alter table public.vehicles add constraint vehicles_cc_check check (cc is null or cc >= 1);
alter table public.vehicles add constraint vehicles_current_mileage_check check (current_mileage is null or current_mileage >= 0);

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_type text not null,
  service_date date not null,
  mileage integer,
  recommended_interval_km integer,
  estimated_cost numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_records_type_check check (
    service_type in (
      'Servicio de Motor',
      'Servicio de Caja',
      'Servicio de Frenos',
      'Servicio de Suspension',
      'Servicio de Direccion',
      'Servicio Electrico',
      'Servicio de Aire Acondicionado',
      'Servicio de Llantas',
      'Alineacion y Balanceo',
      'Cambio de Aceite',
      'Diagnostico General',
      'Escaneo Computarizado',
      'Revision Pre-compra',
      'Mantenimiento General'
    )
  ),
  constraint service_records_mileage_check check (mileage is null or mileage >= 0)
);

alter table public.service_records add column if not exists recommended_interval_km integer;
alter table public.service_records add column if not exists estimated_cost numeric;
alter table public.service_records drop constraint if exists service_records_recommended_interval_check;
alter table public.service_records drop constraint if exists service_records_estimated_cost_check;
alter table public.service_records add constraint service_records_recommended_interval_check check (
  recommended_interval_km is null or recommended_interval_km >= 0
);
alter table public.service_records add constraint service_records_estimated_cost_check check (
  estimated_cost is null or estimated_cost >= 0
);

alter table public.service_records drop constraint if exists service_records_type_check;
alter table public.service_records add constraint service_records_type_check check (
  service_type in (
    'Servicio de Motor',
    'Servicio de Caja',
    'Servicio de Frenos',
    'Servicio de Suspension',
    'Servicio de Direccion',
    'Servicio Electrico',
    'Servicio de Aire Acondicionado',
    'Servicio de Llantas',
    'Alineacion y Balanceo',
    'Cambio de Aceite',
    'Diagnostico General',
    'Escaneo Computarizado',
    'Revision Pre-compra',
    'Mantenimiento General'
  )
);

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_records enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
drop policy if exists "Users can insert their profile" on public.profiles;
drop policy if exists "Users can update their profile" on public.profiles;
drop policy if exists "Users can delete their profile" on public.profiles;
drop policy if exists "Users can read their vehicles" on public.vehicles;
drop policy if exists "Users can insert their vehicles" on public.vehicles;
drop policy if exists "Users can update their vehicles" on public.vehicles;
drop policy if exists "Users can delete their vehicles" on public.vehicles;
drop policy if exists "Users can read their service records" on public.service_records;
drop policy if exists "Users can insert their service records" on public.service_records;
drop policy if exists "Users can update their service records" on public.service_records;
drop policy if exists "Users can delete their service records" on public.service_records;

create policy "Users can read their profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their vehicles"
  on public.vehicles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their vehicles"
  on public.vehicles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their vehicles"
  on public.vehicles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their vehicles"
  on public.vehicles
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their service records"
  on public.service_records
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their service records"
  on public.service_records
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.vehicles
      where vehicles.id = service_records.vehicle_id
        and vehicles.user_id = auth.uid()
    )
  );

create policy "Users can update their service records"
  on public.service_records
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their service records"
  on public.service_records
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists vehicles_user_id_created_at_idx
  on public.vehicles (user_id, created_at desc);

create index if not exists service_records_user_id_service_date_idx
  on public.service_records (user_id, service_date desc);

create index if not exists service_records_vehicle_id_idx
  on public.service_records (vehicle_id);
