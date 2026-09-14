create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
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
alter table public.profiles add column if not exists phone text;
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
  vin text,
  make text,
  model_line text,
  model_year integer,
  engine text,
  usage text,
  vehicle_type text,
  seats integer,
  color text,
  cylinders numeric,
  cc numeric,
  current_mileage numeric,
  current_mileage_unit text not null default 'km',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_vin_length check (vin is null or char_length(vin) between 6 and 17),
  constraint vehicles_model_year_check check (model_year is null or model_year between 1900 and 2100),
  constraint vehicles_seats_check check (seats is null or seats >= 1),
  constraint vehicles_cylinders_check check (cylinders is null or cylinders >= 0),
  constraint vehicles_cc_check check (cc is null or cc >= 0),
  constraint vehicles_current_mileage_check check (current_mileage is null or current_mileage >= 0),
  constraint vehicles_current_mileage_unit_check check (current_mileage_unit in ('km', 'mi'))
);

alter table public.vehicles add column if not exists plate text;
alter table public.vehicles alter column vin drop not null;
alter table public.vehicles alter column make drop not null;
alter table public.vehicles alter column model_line drop not null;
alter table public.vehicles alter column engine drop not null;
alter table public.vehicles add column if not exists model_year integer;
alter table public.vehicles add column if not exists usage text;
alter table public.vehicles add column if not exists vehicle_type text;
alter table public.vehicles add column if not exists seats integer;
alter table public.vehicles add column if not exists color text;
alter table public.vehicles add column if not exists cylinders numeric;
alter table public.vehicles add column if not exists cc numeric;
alter table public.vehicles add column if not exists current_mileage numeric;
alter table public.vehicles add column if not exists current_mileage_unit text not null default 'km';
alter table public.vehicles alter column cylinders type numeric using cylinders::numeric;
alter table public.vehicles alter column cc type numeric using cc::numeric;
alter table public.vehicles alter column current_mileage type numeric using current_mileage::numeric;

alter table public.vehicles drop constraint if exists vehicles_vin_length;
alter table public.vehicles drop constraint if exists vehicles_model_year_check;
alter table public.vehicles drop constraint if exists vehicles_seats_check;
alter table public.vehicles drop constraint if exists vehicles_cylinders_check;
alter table public.vehicles drop constraint if exists vehicles_cc_check;
alter table public.vehicles drop constraint if exists vehicles_current_mileage_check;
alter table public.vehicles drop constraint if exists vehicles_current_mileage_unit_check;

alter table public.vehicles add constraint vehicles_vin_length check (vin is null or char_length(vin) between 6 and 17);
alter table public.vehicles add constraint vehicles_model_year_check check (model_year is null or model_year between 1900 and 2100);
alter table public.vehicles add constraint vehicles_seats_check check (seats is null or seats >= 1);
alter table public.vehicles add constraint vehicles_cylinders_check check (cylinders is null or cylinders >= 0);
alter table public.vehicles add constraint vehicles_cc_check check (cc is null or cc >= 0);
alter table public.vehicles add constraint vehicles_current_mileage_check check (current_mileage is null or current_mileage >= 0);
alter table public.vehicles add constraint vehicles_current_mileage_unit_check check (current_mileage_unit in ('km', 'mi'));

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

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback text not null,
  created_at timestamptz not null default now(),
  constraint wishlist_items_feedback_check check (char_length(trim(feedback)) between 3 and 1000)
);

create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  contact_phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealer_vehicle_records (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  customer_name text,
  customer_phone text,
  customer_email text,
  plate text,
  vin text,
  make text,
  model_line text,
  model_year integer,
  engine text,
  mileage numeric,
  mileage_unit text not null default 'km',
  service_type text not null,
  service_date date not null default current_date,
  estimated_cost numeric,
  notes text,
  claim_code text not null unique default encode(gen_random_bytes(12), 'hex'),
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dealer_vehicle_records_vin_length check (vin is null or char_length(vin) between 6 and 17),
  constraint dealer_vehicle_records_model_year_check check (model_year is null or model_year between 1900 and 2100),
  constraint dealer_vehicle_records_mileage_check check (mileage is null or mileage >= 0),
  constraint dealer_vehicle_records_mileage_unit_check check (mileage_unit in ('km', 'mi')),
  constraint dealer_vehicle_records_estimated_cost_check check (estimated_cost is null or estimated_cost >= 0)
);

alter table public.dealers add column if not exists contact_phone text;
alter table public.dealers add column if not exists address text;

alter table public.dealer_vehicle_records add column if not exists customer_name text;
alter table public.dealer_vehicle_records add column if not exists customer_phone text;
alter table public.dealer_vehicle_records add column if not exists customer_email text;
alter table public.dealer_vehicle_records add column if not exists plate text;
alter table public.dealer_vehicle_records add column if not exists vin text;
alter table public.dealer_vehicle_records add column if not exists make text;
alter table public.dealer_vehicle_records add column if not exists model_line text;
alter table public.dealer_vehicle_records add column if not exists model_year integer;
alter table public.dealer_vehicle_records add column if not exists engine text;
alter table public.dealer_vehicle_records add column if not exists mileage numeric;
alter table public.dealer_vehicle_records add column if not exists mileage_unit text not null default 'km';
alter table public.dealer_vehicle_records add column if not exists service_type text not null default 'Mantenimiento General';
alter table public.dealer_vehicle_records add column if not exists service_date date not null default current_date;
alter table public.dealer_vehicle_records add column if not exists estimated_cost numeric;
alter table public.dealer_vehicle_records add column if not exists notes text;
alter table public.dealer_vehicle_records add column if not exists claim_code text not null default encode(gen_random_bytes(12), 'hex');
alter table public.dealer_vehicle_records add column if not exists claimed_by_user_id uuid references auth.users(id) on delete set null;
alter table public.dealer_vehicle_records add column if not exists claimed_at timestamptz;
alter table public.dealer_vehicle_records alter column mileage type numeric using mileage::numeric;

alter table public.dealer_vehicle_records drop constraint if exists dealer_vehicle_records_vin_length;
alter table public.dealer_vehicle_records drop constraint if exists dealer_vehicle_records_model_year_check;
alter table public.dealer_vehicle_records drop constraint if exists dealer_vehicle_records_mileage_check;
alter table public.dealer_vehicle_records drop constraint if exists dealer_vehicle_records_mileage_unit_check;
alter table public.dealer_vehicle_records drop constraint if exists dealer_vehicle_records_estimated_cost_check;

alter table public.dealer_vehicle_records add constraint dealer_vehicle_records_vin_length check (vin is null or char_length(vin) between 6 and 17);
alter table public.dealer_vehicle_records add constraint dealer_vehicle_records_model_year_check check (model_year is null or model_year between 1900 and 2100);
alter table public.dealer_vehicle_records add constraint dealer_vehicle_records_mileage_check check (mileage is null or mileage >= 0);
alter table public.dealer_vehicle_records add constraint dealer_vehicle_records_mileage_unit_check check (mileage_unit in ('km', 'mi'));
alter table public.dealer_vehicle_records add constraint dealer_vehicle_records_estimated_cost_check check (estimated_cost is null or estimated_cost >= 0);

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_records enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_vehicle_records enable row level security;

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
drop policy if exists "Users can read their wishlist items" on public.wishlist_items;
drop policy if exists "Users can insert their wishlist items" on public.wishlist_items;
drop policy if exists "Dealers can read their dealer profile" on public.dealers;
drop policy if exists "Dealers can insert their dealer profile" on public.dealers;
drop policy if exists "Dealers can update their dealer profile" on public.dealers;
drop policy if exists "Customers can read dealers from claimed records" on public.dealers;
drop policy if exists "Dealers can read their own records" on public.dealer_vehicle_records;
drop policy if exists "Dealers can insert their own records" on public.dealer_vehicle_records;
drop policy if exists "Dealers can update their own records" on public.dealer_vehicle_records;
drop policy if exists "Customers can claim open dealer records" on public.dealer_vehicle_records;
drop policy if exists "Customers can read claimed dealer records" on public.dealer_vehicle_records;
drop policy if exists "Customers can read matching pending dealer records" on public.dealer_vehicle_records;
drop policy if exists "Customers can claim matching pending dealer records" on public.dealer_vehicle_records;
drop policy if exists "Customers can read dealers from matching pending records" on public.dealers;

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

create policy "Users can read their wishlist items"
  on public.wishlist_items
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their wishlist items"
  on public.wishlist_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Dealers can read their dealer profile"
  on public.dealers
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Dealers can insert their dealer profile"
  on public.dealers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Dealers can update their dealer profile"
  on public.dealers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Customers can read dealers from claimed records"
  on public.dealers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dealer_vehicle_records
      where dealer_vehicle_records.dealer_id = dealers.id
        and dealer_vehicle_records.claimed_by_user_id = auth.uid()
    )
  );

create policy "Customers can read dealers from matching pending records"
  on public.dealers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dealer_vehicle_records
      left join public.profiles on profiles.user_id = auth.uid()
      where dealer_vehicle_records.dealer_id = dealers.id
        and dealer_vehicle_records.claimed_by_user_id is null
        and (
          (dealer_vehicle_records.customer_email is not null and dealer_vehicle_records.customer_email = (auth.jwt() ->> 'email'))
          or (dealer_vehicle_records.customer_phone is not null and dealer_vehicle_records.customer_phone = profiles.phone)
        )
    )
  );

create policy "Dealers can read their own records"
  on public.dealer_vehicle_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dealers
      where dealers.id = dealer_vehicle_records.dealer_id
        and dealers.user_id = auth.uid()
    )
  );

create policy "Dealers can insert their own records"
  on public.dealer_vehicle_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.dealers
      where dealers.id = dealer_vehicle_records.dealer_id
        and dealers.user_id = auth.uid()
    )
  );

create policy "Dealers can update their own records"
  on public.dealer_vehicle_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.dealers
      where dealers.id = dealer_vehicle_records.dealer_id
        and dealers.user_id = auth.uid()
    )
  );

create policy "Customers can claim open dealer records"
  on public.dealer_vehicle_records
  for update
  to authenticated
  using (claimed_by_user_id is null)
  with check (claimed_by_user_id = auth.uid());

create policy "Customers can read claimed dealer records"
  on public.dealer_vehicle_records
  for select
  to authenticated
  using (claimed_by_user_id = auth.uid());

create policy "Customers can read matching pending dealer records"
  on public.dealer_vehicle_records
  for select
  to authenticated
  using (
    claimed_by_user_id is null
    and (
      (customer_email is not null and customer_email = (auth.jwt() ->> 'email'))
      or exists (
        select 1
        from public.profiles
        where profiles.user_id = auth.uid()
          and profiles.phone is not null
          and profiles.phone = dealer_vehicle_records.customer_phone
      )
    )
  );

create policy "Customers can claim matching pending dealer records"
  on public.dealer_vehicle_records
  for update
  to authenticated
  using (
    claimed_by_user_id is null
    and (
      (customer_email is not null and customer_email = (auth.jwt() ->> 'email'))
      or exists (
        select 1
        from public.profiles
        where profiles.user_id = auth.uid()
          and profiles.phone is not null
          and profiles.phone = dealer_vehicle_records.customer_phone
      )
    )
  )
  with check (claimed_by_user_id = auth.uid());

create index if not exists vehicles_user_id_created_at_idx
  on public.vehicles (user_id, created_at desc);

create index if not exists service_records_user_id_service_date_idx
  on public.service_records (user_id, service_date desc);

create index if not exists service_records_vehicle_id_idx
  on public.service_records (vehicle_id);

create index if not exists wishlist_items_user_id_created_at_idx
  on public.wishlist_items (user_id, created_at desc);

create index if not exists dealers_user_id_idx
  on public.dealers (user_id);

create index if not exists dealer_vehicle_records_dealer_id_created_at_idx
  on public.dealer_vehicle_records (dealer_id, created_at desc);

create index if not exists dealer_vehicle_records_claim_code_idx
  on public.dealer_vehicle_records (claim_code);

create index if not exists dealer_vehicle_records_claimed_by_user_id_idx
  on public.dealer_vehicle_records (claimed_by_user_id, service_date desc);

create index if not exists profiles_phone_idx
  on public.profiles (phone);

create index if not exists dealer_vehicle_records_customer_contact_idx
  on public.dealer_vehicle_records (customer_email, customer_phone)
  where claimed_by_user_id is null;
