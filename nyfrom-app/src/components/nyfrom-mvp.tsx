"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler, FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";

type Profile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  birth_date: string | null;
  driving_distance: number | null;
  distance_period: "daily" | "monthly";
};

type Vehicle = {
  id: string;
  owner_name: string;
  plate: string | null;
  vin: string;
  make: string;
  model_line: string;
  model_year: number | null;
  engine: string;
  usage: string | null;
  vehicle_type: string | null;
  seats: number | null;
  color: string | null;
  cylinders: number | null;
  cc: number | null;
};

type ServiceRecord = {
  id: string;
  vehicle_id: string;
  service_type: string;
  service_date: string;
  mileage: number | null;
  recommended_interval_km: number | null;
  estimated_cost: number | null;
  notes: string | null;
  vehicles: {
    plate: string | null;
    make: string;
    model_line: string;
    model_year: number | null;
    vin: string;
  } | null;
};

const serviceIntervals: Record<string, number> = {
  "Servicio de Motor": 7000,
  "Cambio de Aceite": 7000,
  "Servicio de Caja": 40000,
  "Servicio de Frenos": 15000,
  "Servicio de Suspension": 20000,
  "Servicio de Direccion": 20000,
  "Servicio Electrico": 12000,
  "Servicio de Aire Acondicionado": 12000,
  "Servicio de Llantas": 10000,
  "Alineacion y Balanceo": 10000,
  "Diagnostico General": 10000,
  "Escaneo Computarizado": 10000,
  "Revision Pre-compra": 0,
  "Mantenimiento General": 10000,
};

const serviceTypes = Object.keys(serviceIntervals);
const usageTypes = ["Particular", "Comercial", "Alquiler", "Carga", "Publico", "Otro"];
const vehicleTypes = ["Automovil", "Camioneta", "Pickup", "Panel", "Camion", "Motocicleta", "Otro"];
const today = new Date().toISOString().slice(0, 10);

export function NyfromMvp() {
  const configured = hasSupabaseConfig();
  const supabase = useMemo(
    () => (configured ? getSupabaseClient() : null),
    [configured],
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [status, setStatus] = useState("Listo para empezar.");
  const [loading, setLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState("Servicio de Motor");
  const [selectedServiceVehicleId, setSelectedServiceVehicleId] = useState("");
  const [historyVehicleId, setHistoryVehicleId] = useState("all");
  const [activeView, setActiveView] = useState<"summary" | "register">("summary");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const dailyKm = getDailyKm(profile);
  const suggestedServiceDate = getSuggestedServiceDate(
    services,
    editingService?.vehicle_id ?? selectedServiceVehicleId,
  );
  const filteredServices =
    historyVehicleId === "all"
      ? services
      : services.filter((service) => service.vehicle_id === historyVehicleId);
  const upcomingServices = getUpcomingServices(services, dailyKm);
  const filteredUpcomingServices =
    historyVehicleId === "all"
      ? upcomingServices
      : upcomingServices.filter((service) => service.vehicleId === historyVehicleId);
  const nextMonthCost = getNextMonthEstimatedCost(upcomingServices);
  const annualCost = getAnnualServiceCost(services);

  async function loadData() {
    if (!supabase || !user) {
      return;
    }

    const [profileResult, vehiclesResult, servicesResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("vehicles")
        .select(
          "id, owner_name, plate, vin, make, model_line, model_year, engine, usage, vehicle_type, seats, color, cylinders, cc",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("service_records")
        .select(
          "id, vehicle_id, service_type, service_date, mileage, recommended_interval_km, estimated_cost, notes, vehicles(plate, make, model_line, model_year, vin)",
        )
        .order("service_date", { ascending: false })
        .limit(60),
    ]);

    if (profileResult.error) {
      setStatus(`No se pudo cargar perfil: ${profileResult.error.message}`);
      return;
    }

    if (vehiclesResult.error) {
      setStatus(`No se pudieron cargar vehiculos: ${vehiclesResult.error.message}`);
      return;
    }

    if (servicesResult.error) {
      setStatus(`No se pudo cargar historial: ${servicesResult.error.message}`);
      return;
    }

    setProfile(profileResult.data as Profile | null);
    setVehicles(vehiclesResult.data ?? []);
    setServices(normalizeServices(servicesResult.data ?? []));
  }

  async function handleAuth(formData: FormData) {
    if (!supabase) {
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setLoading(true);
    setStatus("Procesando acceso...");

    const result =
      authMode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setStatus(result.error.message);
      return;
    }

    if (authMode === "signup" && !result.data.session) {
      setStatus("Cuenta creada. Revisa tu correo si Supabase pide confirmacion.");
      return;
    }

    setStatus("Sesion iniciada.");
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setProfile(null);
    setVehicles([]);
    setServices([]);
    setStatus("Sesion cerrada.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      user_id: user.id,
      first_name: String(formData.get("first_name") ?? "").trim() || null,
      last_name: String(formData.get("last_name") ?? "").trim() || null,
      gender: String(formData.get("gender") ?? "").trim() || null,
      birth_date: String(formData.get("birth_date") ?? "").trim() || null,
      driving_distance: parseOptionalNumber(formData.get("driving_distance")),
      distance_period: String(formData.get("distance_period") ?? "daily"),
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      setStatus(`No se pudo guardar perfil: ${error.message}`);
      return;
    }

    setStatus("Perfil guardado.");
    await loadData();
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const ownerName = getProfileName(profile) || user.email || "Sin nombre";
    const payload = {
      user_id: user.id,
      owner_name: ownerName,
      plate: String(formData.get("plate") ?? "").trim().toUpperCase() || null,
      vin: String(formData.get("vin") ?? "").trim().toUpperCase(),
      make: String(formData.get("make") ?? "").trim(),
      model_line: String(formData.get("model_line") ?? "").trim(),
      model_year: parseOptionalNumber(formData.get("model_year")),
      engine: String(formData.get("engine") ?? "").trim(),
      usage: String(formData.get("usage") ?? "").trim() || null,
      vehicle_type: String(formData.get("vehicle_type") ?? "").trim() || null,
      seats: parseOptionalNumber(formData.get("seats")),
      color: String(formData.get("color") ?? "").trim() || null,
      cylinders: parseOptionalNumber(formData.get("cylinders")),
      cc: parseOptionalNumber(formData.get("cc")),
    };

    const request = editingVehicle
      ? supabase.from("vehicles").update(payload).eq("id", editingVehicle.id)
      : supabase.from("vehicles").insert(payload);

    const { error } = await request;

    if (error) {
      setStatus(`No se pudo guardar vehiculo: ${error.message}`);
      return;
    }

    form.reset();
    setEditingVehicle(null);
    setStatus(editingVehicle ? "Vehiculo actualizado." : "Vehiculo guardado.");
    await loadData();
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const serviceType = String(formData.get("service_type") ?? "");
    const interval =
      parseOptionalNumber(formData.get("recommended_interval_km")) ??
      serviceIntervals[serviceType] ??
      null;
    const payload = {
      user_id: user.id,
      vehicle_id: String(formData.get("vehicle_id") ?? ""),
      service_type: serviceType,
      service_date: String(formData.get("service_date") ?? ""),
      mileage: parseOptionalNumber(formData.get("mileage")),
      recommended_interval_km: interval,
      estimated_cost: parseOptionalNumber(formData.get("estimated_cost")),
      notes: String(formData.get("notes") ?? "").trim(),
    };

    const request = editingService
      ? supabase.from("service_records").update(payload).eq("id", editingService.id)
      : supabase.from("service_records").insert(payload);

    const { error } = await request;

    if (error) {
      setStatus(`No se pudo guardar servicio: ${error.message}`);
      return;
    }

    form.reset();
    setEditingService(null);
    setSelectedServiceVehicleId(payload.vehicle_id);
    setSelectedServiceType("Servicio de Motor");
    setStatus(editingService ? "Servicio actualizado." : "Servicio guardado.");
    await loadData();
  }

  async function deleteVehicle(vehicle: Vehicle) {
    if (!supabase || !window.confirm(`Borrar ${vehicleLabel(vehicle)}? Tambien se borrara su historial.`)) {
      return;
    }

    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);

    if (error) {
      setStatus(`No se pudo borrar vehiculo: ${error.message}`);
      return;
    }

    setStatus("Vehiculo borrado.");
    await loadData();
  }

  async function deleteService(service: ServiceRecord) {
    if (!supabase || !window.confirm(`Borrar ${service.service_type} del ${formatDate(service.service_date)}?`)) {
      return;
    }

    const { error } = await supabase.from("service_records").delete().eq("id", service.id);

    if (error) {
      setStatus(`No se pudo borrar servicio: ${error.message}`);
      return;
    }

    setStatus("Servicio borrado.");
    await loadData();
  }

  if (!configured) {
    return (
      <main className="mx-auto grid min-h-screen w-[min(1320px,calc(100%-24px))] content-center gap-5 py-12">
        <BrandHeader />
        <section className="rounded-lg border border-white/12 bg-[#1d2024] p-7 shadow-xl shadow-black/20">
          <p className="mb-2 text-xs font-black uppercase text-red-300">Configuracion pendiente</p>
          <h1 className="mb-4 text-4xl font-black tracking-normal">Falta conectar Supabase</h1>
          <p className="max-w-2xl text-zinc-300">
            Crea un archivo <code className="font-mono">.env.local</code> con
            <code className="font-mono"> NEXT_PUBLIC_SUPABASE_URL</code> y
            <code className="font-mono"> NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto grid min-h-screen w-[min(1320px,calc(100%-24px))] content-center gap-5 py-12">
        <BrandHeader />
        <section className="max-w-md rounded-lg border border-white/12 bg-[#1d2024] p-7 shadow-xl shadow-black/20">
          <div className="mb-5 grid grid-cols-2 rounded-lg border border-white/12 bg-white/5 p-1">
            <button
              className={`min-h-11 rounded-md font-black ${authMode === "signin" ? "bg-red-600 text-white" : "text-zinc-400"}`}
              type="button"
              onClick={() => setAuthMode("signin")}
            >
              <ButtonLabel icon="🔑">Entrar</ButtonLabel>
            </button>
            <button
              className={`min-h-11 rounded-md font-black ${authMode === "signup" ? "bg-red-600 text-white" : "text-zinc-400"}`}
              type="button"
              onClick={() => setAuthMode("signup")}
            >
              <ButtonLabel icon="➕">Crear cuenta</ButtonLabel>
            </button>
          </div>

          <form className="grid gap-4" action={handleAuth}>
            <TextField label="Correo" name="email" type="email" required />
            <TextField label="Contrasena" name="password" type="password" required />
            <button
              className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white shadow-lg shadow-red-950/30 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              <ButtonLabel icon={authMode === "signin" ? "🔑" : "➕"}>
                {authMode === "signin" ? "Entrar" : "Crear cuenta"}
              </ButtonLabel>
            </button>
          </form>
          <StatusMessage message={status} />
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-[min(1520px,calc(100%-24px))] py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <BrandHeader compact />
        <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-zinc-400">
          <span>{user.email}</span>
          <button className="min-h-11 rounded-lg border border-white/12 bg-white/5 px-4 font-black text-white" type="button" onClick={handleLogout}>
            <ButtonLabel icon="🚪">Cerrar sesion</ButtonLabel>
          </button>
        </div>
      </header>

      <section className="mb-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <VehicleOverview
          vehicles={vehicles}
          services={services}
          nextMonthCost={nextMonthCost}
          annualCost={annualCost}
        />
        <ProfileSummary profile={profile} userEmail={user.email ?? ""} dailyKm={dailyKm} />
      </section>

      <section className="mb-5 grid grid-cols-2 gap-2 rounded-lg border border-white/12 bg-[#1d2024] p-2 shadow-xl shadow-black/20">
        <TabButton active={activeView === "summary"} onClick={() => setActiveView("summary")}>
          <ButtonLabel icon="📊">Resumen</ButtonLabel>
        </TabButton>
        <TabButton active={activeView === "register"} onClick={() => setActiveView("register")}>
          <ButtonLabel icon="📝">Registrar datos</ButtonLabel>
        </TabButton>
      </section>

      {activeView === "register" ? (
        <>
      <section className="mb-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel eyebrow="Usuario" title="Perfil y recorrido" id="perfil">
          <form className="grid gap-4" onSubmit={saveProfile} key={profile?.user_id ?? "profile"}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Nombre" name="first_name" defaultValue={profile?.first_name ?? ""} />
              <TextField label="Apellido" name="last_name" defaultValue={profile?.last_name ?? ""} />
              <SelectField label="Genero" name="gender" defaultValue={profile?.gender ?? ""}>
                <option value="">Selecciona genero</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </SelectField>
              <TextField label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={profile?.birth_date ?? ""} />
              <TextField label="Km recorridos" name="driving_distance" type="number" min={0} defaultValue={profile?.driving_distance ?? ""} />
              <SelectField label="Periodo" name="distance_period" defaultValue={profile?.distance_period ?? "daily"}>
                <option value="daily">Por dia</option>
                <option value="monthly">Por mes</option>
              </SelectField>
            </div>
            <button className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white" type="submit">
              <ButtonLabel icon="💾">Guardar perfil</ButtonLabel>
            </button>
          </form>
        </Panel>

        <Panel eyebrow="Registro" title={editingVehicle ? "Editar vehiculo" : "Datos del vehiculo"} id="vehiculo-form">
          <form className="grid gap-4" onSubmit={saveVehicle} key={editingVehicle?.id ?? "new-vehicle"}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Placa" name="plate" defaultValue={editingVehicle?.plate ?? ""} />
              <TextField label="VIN" name="vin" maxLength={17} required defaultValue={editingVehicle?.vin ?? ""} />
              <TextField label="Marca" name="make" required defaultValue={editingVehicle?.make ?? ""} />
              <TextField label="Linea" name="model_line" required defaultValue={editingVehicle?.model_line ?? ""} />
              <TextField label="Modelo" name="model_year" type="number" min={1900} defaultValue={editingVehicle?.model_year ?? ""} />
              <TextField label="Motor" name="engine" required defaultValue={editingVehicle?.engine ?? ""} />
              <SelectField label="Uso" name="usage" defaultValue={editingVehicle?.usage ?? ""}>
                <option value="">Selecciona uso</option>
                {usageTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </SelectField>
              <SelectField label="Tipo" name="vehicle_type" defaultValue={editingVehicle?.vehicle_type ?? ""}>
                <option value="">Selecciona tipo</option>
                {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </SelectField>
              <TextField label="Asientos" name="seats" type="number" min={1} defaultValue={editingVehicle?.seats ?? ""} />
              <TextField label="Color" name="color" defaultValue={editingVehicle?.color ?? ""} />
              <TextField label="Cilindros" name="cylinders" type="number" min={1} defaultValue={editingVehicle?.cylinders ?? ""} />
              <TextField label="CC" name="cc" type="number" min={1} defaultValue={editingVehicle?.cc ?? ""} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white" type="submit">
                <ButtonLabel icon={editingVehicle ? "✏️" : "💾"}>
                  {editingVehicle ? "Actualizar vehiculo" : "Guardar vehiculo"}
                </ButtonLabel>
              </button>
              {editingVehicle ? (
                <button className="min-h-12 rounded-lg border border-white/12 px-5 font-black text-white" type="button" onClick={() => setEditingVehicle(null)}>
                  <ButtonLabel icon="✕">Cancelar</ButtonLabel>
                </button>
              ) : null}
            </div>
          </form>
        </Panel>
      </section>

      <section className="mb-5">
        <Panel eyebrow="Historial" title={editingService ? "Editar servicio" : "Registrar servicio"} id="servicio-form">
          <form className="grid gap-4" onSubmit={saveService} key={`${editingService?.id ?? "new-service"}-${selectedServiceVehicleId}`}>
            <SelectField
              label="Vehiculo"
              name="vehicle_id"
              required
              defaultValue={editingService?.vehicle_id ?? selectedServiceVehicleId}
              onChange={(event) => setSelectedServiceVehicleId(event.currentTarget.value)}
            >
              <option value="">Selecciona un vehiculo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleIcon(vehicle)} {vehicleLabel(vehicle)}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Tipo de servicio"
                name="service_type"
                required
                defaultValue={editingService?.service_type ?? selectedServiceType}
                onChange={(event) => setSelectedServiceType(event.currentTarget.value)}
              >
                {serviceTypes.map((type) => <option key={type} value={type}>{serviceIcon(type)} {type}</option>)}
              </SelectField>
              <TextField
                key={`${editingService?.id ?? "new"}-${selectedServiceVehicleId}-date`}
                label="Fecha"
                name="service_date"
                type="date"
                required
                defaultValue={editingService?.service_date ?? suggestedServiceDate}
              />
              <TextField label="Kilometraje actual" name="mileage" type="number" min={0} defaultValue={editingService?.mileage ?? ""} />
              <TextField label="Monto estimado (Q)" name="estimated_cost" type="number" min={0} defaultValue={editingService?.estimated_cost ?? ""} />
              <TextField
                key={`${editingService?.id ?? "new"}-${selectedServiceType}`}
                label="Proximo servicio recomendado (km)"
                name="recommended_interval_km"
                type="number"
                min={0}
                defaultValue={editingService?.recommended_interval_km ?? serviceIntervals[selectedServiceType] ?? ""}
              />
            </div>
            <label className="grid gap-2 text-sm font-bold text-zinc-200">
              Notas
              <textarea
                className="min-h-28 rounded-lg border border-white/12 bg-black/25 px-4 py-3 text-white outline-none focus:border-red-300"
                name="notes"
                defaultValue={editingService?.notes ?? ""}
                placeholder="Repuestos, observaciones o proximo servicio."
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white" type="submit">
                <ButtonLabel icon={editingService ? "✏️" : "💾"}>
                  {editingService ? "Actualizar servicio" : "Guardar servicio"}
                </ButtonLabel>
              </button>
              {editingService ? (
                <button className="min-h-12 rounded-lg border border-white/12 px-5 font-black text-white" type="button" onClick={() => setEditingService(null)}>
                  <ButtonLabel icon="✕">Cancelar</ButtonLabel>
                </button>
              ) : null}
            </div>
          </form>
        </Panel>
      </section>
        </>
      ) : null}

      {activeView === "summary" ? (
        <>
      <section className="mb-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Proximo servicio" title="🧰 Proximo servicio" id="proximos-servicios">
          <div className="mb-4">
            <SelectField label="Filtrar por vehiculo" name="upcoming_filter" value={historyVehicleId} onChange={(event) => setHistoryVehicleId(event.currentTarget.value)}>
              <option value="all">Todos los vehiculos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicleIcon(vehicle)} {vehicleLabel(vehicle)}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid max-h-[620px] gap-3 overflow-auto pr-1">
            {filteredUpcomingServices.length ? (
              filteredUpcomingServices.map((item) => (
                <RecordCard key={item.id}>
                  <strong><IconText icon={serviceIcon(item.serviceType)}>{item.serviceType} - {item.vehicle}</IconText></strong>
                  <span>
                    Proximo kilometraje: {item.nextMileage ? `${item.nextMileage.toLocaleString("es-GT")} km` : "No ingresado"}
                  </span>
                  <span>Fecha estimada: {formatDate(item.estimatedDate)}</span>
                  <span>Costo estimado: {formatMoney(item.estimatedCost)}</span>
                  <span>Base: {item.intervalKm.toLocaleString("es-GT")} km / {dailyKm.toFixed(1)} km diarios</span>
                </RecordCard>
              ))
            ) : (
              <EmptyState text="No hay proximos servicios para este filtro." />
            )}
          </div>
        </Panel>

        <Panel eyebrow="Servicios" title="🧰 Historial reciente" id="historial">
          <div className="mb-4">
            <SelectField label="Filtrar por vehiculo" name="history_filter" value={historyVehicleId} onChange={(event) => setHistoryVehicleId(event.currentTarget.value)}>
              <option value="all">Todos los vehiculos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicleIcon(vehicle)} {vehicleLabel(vehicle)}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid max-h-[620px] gap-3 overflow-auto pr-1">
            {filteredServices.length ? (
              filteredServices.map((service) => (
                <RecordCard key={service.id}>
                  <strong><IconText icon={serviceIcon(service.service_type)}>{service.service_type} - {formatDate(service.service_date)}</IconText></strong>
                  <span>
                    {serviceVehicleLabel(service)}
                    {service.mileage ? ` - ${service.mileage.toLocaleString("es-GT")} km` : ""}
                  </span>
                  <span>
                    Proximo recomendado: {getServiceInterval(service) ? `${getServiceInterval(service).toLocaleString("es-GT")} km` : "Sin recomendacion"}
                  </span>
                  <span>Costo registrado: {formatMoney(service.estimated_cost)}</span>
                  <span>{service.notes || "Sin notas"}</span>
                  <ActionRow>
                    <button type="button" onClick={() => {
                      setEditingService(service);
                      setSelectedServiceType(service.service_type);
                      setSelectedServiceVehicleId(service.vehicle_id);
                      setActiveView("register");
                    }}><ButtonLabel icon="✏️">Editar</ButtonLabel></button>
                    <button type="button" onClick={() => void deleteService(service)}><ButtonLabel icon="🗑️">Borrar</ButtonLabel></button>
                  </ActionRow>
                </RecordCard>
              ))
            ) : (
              <EmptyState text="No hay servicios para este filtro." />
            )}
          </div>
        </Panel>
      </section>

      <section>
        <Panel eyebrow="Vehiculos" title="🚗 Registros guardados">
          <div className="grid gap-3 md:grid-cols-2">
            {vehicles.length ? (
              vehicles.map((vehicle) => (
                <RecordCard key={vehicle.id}>
                  <strong><IconText icon={vehicleIcon(vehicle)}>{vehicleLabel(vehicle)}</IconText></strong>
                  <span>VIN: {vehicle.vin}</span>
                  <span>
                    Motor: {vehicle.engine}
                    {vehicle.cylinders ? ` - ${vehicle.cylinders} cilindros` : ""}
                    {vehicle.cc ? ` - ${vehicle.cc} cc` : ""}
                  </span>
                  <span>
                    {vehicle.color ? `Color: ${vehicle.color}` : "Color pendiente"}
                    {vehicle.usage ? ` - Uso: ${vehicle.usage}` : ""}
                    {vehicle.vehicle_type ? ` - Tipo: ${vehicle.vehicle_type}` : ""}
                    {vehicle.seats ? ` - ${vehicle.seats} asientos` : ""}
                  </span>
                  <ActionRow>
                    <button type="button" onClick={() => {
                      setEditingVehicle(vehicle);
                      setActiveView("register");
                    }}><ButtonLabel icon="✏️">Editar</ButtonLabel></button>
                    <button type="button" onClick={() => void deleteVehicle(vehicle)}><ButtonLabel icon="🗑️">Borrar</ButtonLabel></button>
                  </ActionRow>
                </RecordCard>
              ))
            ) : (
              <EmptyState text="Aun no hay vehiculos registrados." />
            )}
          </div>
        </Panel>
      </section>
        </>
      ) : null}

      <StatusMessage message={status} />
    </main>
  );
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`grid place-items-center rounded-lg bg-black font-black text-red-500 ${compact ? "h-11 w-11" : "h-14 w-14"}`}>
        NM
      </div>
      <div>
        <p className="mb-1 text-xs font-black uppercase text-red-300">Nyfrom Motors</p>
        <h1 className={`${compact ? "text-lg" : "text-4xl"} font-black`}>NYFROM MOTORS Auto Hub</h1>
        <p className={`${compact ? "text-xs" : "mt-2 text-base"} max-w-md font-bold text-zinc-400`}>
          Todo lo relacionado a tu vehiculo en un solo lugar.
        </p>
      </div>
    </div>
  );
}

function IconText({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function ButtonLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function VehicleSketchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-1 h-[0.9em] w-[1.8em] shrink-0 text-zinc-300"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.4"
      viewBox="0 0 140 58"
    >
      <path d="M8 34c12 0 22-1 33-7 17-9 32-13 53-11 17 2 28 7 38 15" />
      <path d="M10 34c-6 5-6 23 0 23h14c2-13 11-22 24-22 9 0 16 4 21 11h35c5-8 13-12 23-12 8 0 14 3 19 8" />
      <path d="M41 27h55" />
      <path d="M72 17l3 18" />
      <path d="M25 56c2-10 10-17 22-17" />
      <path d="M111 56c2-10 10-17 22-17" />
      <path d="M105 32c8 0 14 2 21 6" />
    </svg>
  );
}

function Panel({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-white/12 bg-[#1d2024] p-6 shadow-xl shadow-black/20">
      <div className="mb-5">
        <p className="mb-2 text-xs font-black uppercase text-red-300">{eyebrow}</p>
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function VehicleOverview({
  vehicles,
  services,
  nextMonthCost,
  annualCost,
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  nextMonthCost: number;
  annualCost: number;
}) {
  const featuredVehicle = vehicles[0];
  const featuredServices = featuredVehicle
    ? services.filter((service) => service.vehicle_id === featuredVehicle.id).length
    : 0;

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/12 bg-[#1d2024] shadow-xl shadow-black/20">
      <div className="absolute inset-0">
        <Image
          className="h-full w-full object-cover object-right opacity-28"
          src="/nyfrom-hero-brand.png"
          alt=""
          fill
          sizes="(max-width: 1180px) 100vw, 1180px"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1d2024] via-[#1d2024]/92 to-[#1d2024]/55" />
      </div>
      <div className="relative grid gap-6 p-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-black uppercase text-red-300">Tus vehiculos</p>
        <h1 className="flex max-w-3xl items-start gap-4 text-4xl font-black tracking-normal md:text-5xl">
          <VehicleSketchIcon />
          <span>{featuredVehicle ? vehicleLabel(featuredVehicle) : "Agrega tu primer vehiculo"}</span>
        </h1>
        <h1 className="hidden">
          {featuredVehicle ? `${vehicleIcon(featuredVehicle)} ${vehicleLabel(featuredVehicle)}` : "🚗 Agrega tu primer vehiculo"}
        </h1>
        <div className="mt-6 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          <MetricCard icon="🚗" label="Vehiculos" value={vehicles.length.toString()} />
          <MetricCard icon="🧰" label="Servicios" value={services.length.toString()} />
          <MetricCard icon="📅" label="Proximo mes" value={formatMoney(nextMonthCost)} />
          <MetricCard icon="💰" label="Costo anual" value={formatMoney(annualCost)} />
        </div>
        {featuredVehicle ? (
          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <SummaryLine label="VIN" value={featuredVehicle.vin} />
            <SummaryLine label="Motor" value={featuredVehicle.engine} />
            <SummaryLine label="Color" value={featuredVehicle.color || "Pendiente"} />
            <SummaryLine label="Historial" value={`${featuredServices} servicios`} />
          </dl>
        ) : (
          <p className="mt-6 max-w-xl text-lg text-zinc-300">
            Usa la pestana Registrar datos para guardar placa, VIN, marca, linea y motor.
          </p>
        )}
      </div>
      <div className="grid content-end rounded-lg border border-white/10 bg-black/25 p-5">
        <p className="text-xs font-black uppercase text-red-300">Costos</p>
        <strong className="mt-2 text-3xl font-black text-white">{formatMoney(nextMonthCost)}</strong>
        <span className="mt-1 text-sm font-bold text-zinc-400">estimado para los proximos 30 dias</span>
        <div className="mt-5 border-t border-white/10 pt-4">
          <span className="text-sm font-bold text-zinc-500">Gasto registrado este año</span>
          <strong className="block text-2xl font-black text-white">{formatMoney(annualCost)}</strong>
        </div>
      </div>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-4">
      <span className="block text-xs font-black uppercase text-zinc-500">
        <IconText icon={icon}>{label}</IconText>
      </span>
      <strong className="mt-1 block break-words text-[clamp(1.25rem,2vw,1.75rem)] font-black leading-tight text-white">
        {value}
      </strong>
    </div>
  );
}

function ProfileSummary({
  profile,
  userEmail,
  dailyKm,
}: {
  profile: Profile | null;
  userEmail: string;
  dailyKm: number;
}) {
  const name = getProfileName(profile) || "Perfil pendiente";

  return (
    <aside className="rounded-lg border border-white/12 bg-[#1d2024] p-6 shadow-xl shadow-black/20">
      <p className="mb-2 text-xs font-black uppercase text-red-300">Tu perfil</p>
      <h2 className="mb-4 text-2xl font-black">{name}</h2>
      <dl className="grid gap-3 text-sm">
        <SummaryLine label="Correo" value={userEmail || "Pendiente"} />
        <SummaryLine label="Genero" value={profile?.gender || "Pendiente"} />
        <SummaryLine label="Nacimiento" value={profile?.birth_date ? formatDate(profile.birth_date) : "Pendiente"} />
        <SummaryLine
          label="Recorrido"
          value={
            profile?.driving_distance
              ? `${profile.driving_distance.toLocaleString("es-GT")} km ${profile.distance_period === "monthly" ? "por mes" : "por dia"}`
              : "Pendiente"
          }
        />
        <SummaryLine label="Promedio diario" value={dailyKm ? `${dailyKm.toFixed(1)} km/dia` : "Pendiente"} />
      </dl>
      <a
        className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-white/12 px-4 font-black text-white"
        href="#perfil"
      >
        Editar perfil
      </a>
    </aside>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/10 pb-3">
      <dt className="font-bold text-zinc-500">{label}</dt>
      <dd className="font-bold text-zinc-200">{value}</dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`min-h-12 rounded-lg px-4 text-sm font-black ${
        active
          ? "bg-red-600 text-white"
          : "border border-white/12 bg-white/5 text-zinc-300 hover:border-red-300"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  name,
  type = "text",
  required = false,
  maxLength,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  defaultValue?: string | number;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="min-h-12 rounded-lg border border-white/12 bg-black/25 px-4 text-white outline-none focus:border-red-300"
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        min={min}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  required = false,
  children,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <select
        className="min-h-12 rounded-lg border border-white/12 bg-black/25 px-4 text-white outline-none focus:border-red-300"
        name={name}
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
  );
}

function RecordCard({ children }: { children: React.ReactNode }) {
  return (
    <article className="grid gap-1 rounded-lg border border-white/12 bg-white/5 p-4 text-sm text-zinc-300">
      {children}
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-white/12 bg-white/5 p-4 text-zinc-400">{text}</p>;
}

function StatusMessage({ message }: { message: string }) {
  return (
    <p className="mt-5 rounded-lg border-l-4 border-red-400 bg-red-950/30 p-4 text-sm font-bold text-zinc-200">
      {message}
    </p>
  );
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2 [&_button]:rounded-md [&_button]:border [&_button]:border-white/12 [&_button]:px-3 [&_button]:py-2 [&_button]:font-bold [&_button]:text-white">{children}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
  }).format(Number(value ?? 0));
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function getProfileName(profile: Profile | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
}

function getDailyKm(profile: Profile | null) {
  const distance = Number(profile?.driving_distance ?? 0);
  if (!distance) {
    return 0;
  }
  return profile?.distance_period === "monthly" ? distance / 30 : distance;
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.make} ${vehicle.model_line}${vehicle.model_year ? ` ${vehicle.model_year}` : ""} - ${vehicle.plate || "Sin placa"}`;
}

function vehicleIcon(vehicle: Vehicle) {
  const type = (vehicle.vehicle_type || "").toLowerCase();
  const seed = vehicle.id || vehicle.plate || vehicle.vin;

  if (type.includes("motocicleta")) {
    return "🏍️";
  }
  if (type.includes("camion")) {
    return pickIcon(["🚚", "🚛"], seed);
  }
  if (type.includes("pickup")) {
    return "🛻";
  }
  if (type.includes("camioneta")) {
    return "🚙";
  }
  if (type.includes("panel")) {
    return "🚐";
  }

  return pickIcon(["🚗", "🚘", "🚙", "🏎️"], seed);
}

function serviceIcon(serviceType: string) {
  const type = serviceType.toLowerCase();

  if (type.includes("motor") || type.includes("aceite")) {
    return "🛢️";
  }
  if (type.includes("caja")) {
    return "⚙️";
  }
  if (type.includes("freno")) {
    return "🛑";
  }
  if (type.includes("suspension")) {
    return "🌀";
  }
  if (type.includes("direccion")) {
    return "🧭";
  }
  if (type.includes("electrico")) {
    return "⚡";
  }
  if (type.includes("aire")) {
    return "❄️";
  }
  if (type.includes("llanta") || type.includes("alineacion")) {
    return "🛞";
  }
  if (type.includes("diagnostico") || type.includes("escaneo")) {
    return "🔎";
  }

  return "🧰";
}

function pickIcon(icons: string[], seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return icons[total % icons.length];
}

function serviceVehicleLabel(service: ServiceRecord) {
  const vehicle = service.vehicles;
  if (!vehicle) {
    return "Vehiculo";
  }
  return `${vehicle.make} ${vehicle.model_line}${vehicle.model_year ? ` ${vehicle.model_year}` : ""} - ${vehicle.plate || vehicle.vin}`;
}

function getUpcomingServices(services: ServiceRecord[], dailyKm: number) {
  if (!dailyKm) {
    return [];
  }

  return services
    .filter((service) => getServiceInterval(service))
    .map((service) => {
      const intervalKm = getServiceInterval(service);
      const days = Math.ceil(intervalKm / dailyKm);
      const date = new Date(`${service.service_date}T00:00:00`);
      date.setDate(date.getDate() + days);

      return {
        id: service.id,
        vehicleId: service.vehicle_id,
        serviceType: service.service_type,
        vehicle: serviceVehicleLabel(service),
        intervalKm,
        estimatedCost: service.estimated_cost ?? 0,
        nextMileage: service.mileage ? service.mileage + intervalKm : null,
        estimatedDate: date.toISOString().slice(0, 10),
      };
    })
    .sort((a, b) => a.estimatedDate.localeCompare(b.estimatedDate));
}

function getServiceInterval(service: ServiceRecord) {
  return service.recommended_interval_km ?? serviceIntervals[service.service_type] ?? 0;
}

function getSuggestedServiceDate(services: ServiceRecord[], vehicleId: string) {
  if (!vehicleId) {
    return today;
  }

  const latestForVehicle = services
    .filter((service) => service.vehicle_id === vehicleId)
    .sort((a, b) => b.service_date.localeCompare(a.service_date))[0];

  return latestForVehicle?.service_date ?? today;
}

function getNextMonthEstimatedCost(
  upcomingServices: Array<{ estimatedDate: string; estimatedCost: number }>,
) {
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + 30);

  return upcomingServices
    .filter((service) => {
      const serviceDate = new Date(`${service.estimatedDate}T00:00:00`);
      return serviceDate >= startOfDay(now) && serviceDate <= limit;
    })
    .reduce((sum, service) => sum + service.estimatedCost, 0);
}

function getAnnualServiceCost(services: ServiceRecord[]) {
  const year = new Date().getFullYear();

  return services
    .filter((service) => new Date(`${service.service_date}T00:00:00`).getFullYear() === year)
    .reduce((sum, service) => sum + Number(service.estimated_cost ?? 0), 0);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function normalizeServices(
  records: Array<Omit<ServiceRecord, "vehicles"> & { vehicles: ServiceRecord["vehicles"] | ServiceRecord["vehicles"][] }>,
) {
  return records.map((record) => ({
    ...record,
    vehicles: Array.isArray(record.vehicles) ? (record.vehicles[0] ?? null) : record.vehicles,
  }));
}
