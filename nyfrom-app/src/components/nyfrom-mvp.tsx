"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEventHandler, FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";

type Profile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: string | null;
  driving_distance: number | null;
  distance_period: "daily" | "monthly";
};

type Vehicle = {
  id: string;
  owner_name: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model_line: string | null;
  model_year: number | null;
  engine: string | null;
  usage: string | null;
  vehicle_type: string | null;
  seats: number | null;
  color: string | null;
  cylinders: number | null;
  cc: number | null;
  current_mileage: number | null;
  current_mileage_unit: "km" | "mi" | null;
};

type ServiceRecord = {
  id: string;
  vehicle_id: string;
  service_type: string;
  service_date: string;
  mileage: number | null;
  recommended_interval_km: number | null;
  next_service_date?: string | null;
  estimated_cost: number | null;
  notes: string | null;
  vehicles: {
    plate: string | null;
    make: string | null;
    model_line: string | null;
    model_year: number | null;
    vin: string | null;
  } | null;
};

type Dealer = {
  id: string;
  user_id: string;
  business_name: string;
  contact_phone: string | null;
  address: string | null;
};

type DealerVehicleRecord = {
  id: string;
  dealer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model_line: string | null;
  model_year: number | null;
  engine: string | null;
  mileage: number | null;
  mileage_unit: "km" | "mi";
  service_type: string;
  service_date: string;
  next_service_applies: boolean | null;
  recommended_interval_km: number | null;
  next_service_date: string | null;
  estimated_cost: number | null;
  notes: string | null;
  claim_code: string;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  created_at: string;
  dealers?: {
    business_name: string;
    contact_phone: string | null;
  } | null;
};

type DealerRecordChangeRequest = {
  id: string;
  dealer_record_id: string;
  requested_action: "edit" | "delete";
  requested_payload: Record<string, unknown> | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type UserMode = "customer" | "dealer";
type AppView = "dashboard" | "profile" | "vehicles" | "services" | "vehicle3d";
type ActivityMetadata = Record<string, string | number | boolean | null>;
type BlueprintPart = {
  id: string;
  group: string;
  label: string;
  percent: number;
  description: string;
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
  "Servicio de Llantas": 50000,
  "Alineacion y Balanceo": 5000,
  "Diagnostico General": 10000,
  "Escaneo Computarizado": 10000,
  "Revision Pre-compra": 0,
  "Mantenimiento General": 10000,
};

const serviceTypes = Object.keys(serviceIntervals);
const usageTypes = ["Particular", "Comercial", "Alquiler", "Carga", "Publico", "Otro"];
const vehicleTypes = ["Automovil", "Camioneta", "Pickup", "Panel", "Camion", "Motocicleta", "Otro"];
const today = new Date().toISOString().slice(0, 10);
const authTimeoutMessage =
  "Supabase no respondio al iniciar sesion. Puede ser por el limite de Disk IO o porque el proyecto esta lento. Intenta de nuevo en unos minutos y revisa Supabase.";

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
  const [claimedDealerRecords, setClaimedDealerRecords] = useState<DealerVehicleRecord[]>([]);
  const [pendingDealerRecords, setPendingDealerRecords] = useState<DealerVehicleRecord[]>([]);
  const [dealerChangeRequests, setDealerChangeRequests] = useState<DealerRecordChangeRequest[]>([]);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [dealerRecords, setDealerRecords] = useState<DealerVehicleRecord[]>([]);
  const [appMode, setAppMode] = useState<UserMode>("customer");
  const [status, setStatus] = useState("Listo para empezar.");
  const [loading, setLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState("Servicio de Motor");
  const [selectedServiceVehicleId, setSelectedServiceVehicleId] = useState("");
  const [historyVehicleId, setHistoryVehicleId] = useState("all");
  const [overviewVehicleId, setOverviewVehicleId] = useState("");
  const [activeView, setActiveView] = useState<AppView>("profile");
  const [latestClaimLink, setLatestClaimLink] = useState("");
  const trackedOpenForUser = useRef<string | null>(null);

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
      void loadDealerData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || appMode !== "customer") {
      return;
    }

    void claimRecordFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appMode]);

  useEffect(() => {
    if (!user || trackedOpenForUser.current === user.id) {
      return;
    }

    trackedOpenForUser.current = user.id;
    void trackActivityForUser(user.id, "app_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || appMode !== "customer") {
      return;
    }

    let nextView: AppView | null = null;

    if (!profile?.driving_distance) {
      nextView = "profile";
    } else if (!vehicles.length) {
      nextView = "vehicles";
    }

    if (nextView && activeView !== nextView) {
      queueMicrotask(() => setActiveView(nextView));
    }
  }, [activeView, appMode, user, profile?.driving_distance, vehicles.length]);

  const dailyKm = getDailyKm(profile);
  const dealerVehicles = mapClaimedDealerRecordsToVehicles(claimedDealerRecords, vehicles);
  const allVehicles = [...vehicles, ...dealerVehicles];
  const dealerServicesForVehicles = mapClaimedDealerRecordsToServices(claimedDealerRecords, allVehicles);
  const allServices = [...services, ...dealerServicesForVehicles]
    .sort((a, b) => b.service_date.localeCompare(a.service_date));
  const overviewVehicle = allVehicles.find((vehicle) => vehicle.id === overviewVehicleId) ?? allVehicles[0] ?? null;
  const suggestedServiceDate = getSuggestedServiceDate(
    allServices,
    editingService?.vehicle_id ?? selectedServiceVehicleId,
  );
  const filteredServices =
    historyVehicleId === "all"
      ? allServices
      : allServices.filter((service) => service.vehicle_id === historyVehicleId);
  const upcomingServices = getUpcomingServices(allServices, allVehicles, dailyKm);
  const filteredUpcomingServices =
    historyVehicleId === "all"
      ? upcomingServices
      : upcomingServices.filter((service) => service.vehicleId === historyVehicleId);
  const healthItems = getServiceHealth(allServices, allVehicles);
  const nextMonthCost = getNextMonthEstimatedCost(upcomingServices);
  const annualCost = getAnnualServiceCost(allServices);

  async function loadData() {
    if (!supabase || !user) {
      return;
    }

    const [profileResult, vehiclesResult, servicesResult, claimedDealerRecordsResult, dealerChangeRequestsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("vehicles")
        .select(
          "id, owner_name, plate, vin, make, model_line, model_year, engine, usage, vehicle_type, seats, color, cylinders, cc, current_mileage, current_mileage_unit",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("service_records")
        .select(
          "id, vehicle_id, service_type, service_date, mileage, recommended_interval_km, next_service_date, estimated_cost, notes, vehicles(plate, make, model_line, model_year, vin)",
        )
        .order("service_date", { ascending: false })
        .limit(60),
      supabase
        .from("dealer_vehicle_records")
        .select("*")
        .eq("claimed_by_user_id", user.id)
        .order("service_date", { ascending: false })
        .limit(60),
      supabase
        .from("dealer_record_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(30),
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

    if (claimedDealerRecordsResult.error) {
      console.warn("No se pudo cargar historial de dealers:", claimedDealerRecordsResult.error.message);
    }

    if (dealerChangeRequestsResult.error) {
      console.warn("No se pudieron cargar solicitudes de dealers:", dealerChangeRequestsResult.error.message);
    }

    const currentProfile = profileResult.data as Profile | null;
    const matchFilters = [
      user.email ? `customer_email.eq.${user.email.trim().toLowerCase()}` : "",
      currentProfile?.phone ? `customer_phone.eq.${normalizePhoneInput(currentProfile.phone)}` : "",
    ].filter(Boolean);
    let pendingDealerRecords: DealerVehicleRecord[] = [];

    if (matchFilters.length) {
      const pendingDealerRecordsResult = await supabase
        .from("dealer_vehicle_records")
        .select("*")
        .is("claimed_by_user_id", null)
        .or(matchFilters.join(","))
        .order("service_date", { ascending: false })
        .limit(20);

      if (pendingDealerRecordsResult.error) {
        console.warn("No se pudo cargar historial pendiente de dealers:", pendingDealerRecordsResult.error.message);
      } else {
        pendingDealerRecords = (pendingDealerRecordsResult.data ?? []) as DealerVehicleRecord[];
      }
    }

    setProfile(currentProfile);
    setVehicles(vehiclesResult.data ?? []);
    setServices(normalizeServices(servicesResult.data ?? []));
    setClaimedDealerRecords((claimedDealerRecordsResult.data ?? []) as DealerVehicleRecord[]);
    setDealerChangeRequests((dealerChangeRequestsResult.data ?? []) as DealerRecordChangeRequest[]);
    setPendingDealerRecords(pendingDealerRecords);
  }

  async function loadDealerData() {
    if (!supabase || !user) {
      return;
    }

    const dealerResult = await supabase.from("dealers").select("*").eq("user_id", user.id).maybeSingle();

    if (dealerResult.error) {
      console.warn("No se pudo cargar dealer:", dealerResult.error.message);
      return;
    }

    const currentDealer = dealerResult.data as Dealer | null;
    setDealer(currentDealer);

    if (!currentDealer) {
      setDealerRecords([]);
      return;
    }

    const recordsResult = await supabase
      .from("dealer_vehicle_records")
      .select("*")
      .eq("dealer_id", currentDealer.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (recordsResult.error) {
      console.warn("No se pudieron cargar registros de dealer:", recordsResult.error.message);
      return;
    }

    setDealerRecords((recordsResult.data ?? []) as DealerVehicleRecord[]);
  }

  async function claimRecordFromUrl() {
    if (!supabase || !user || typeof window === "undefined") {
      return;
    }

    const claimCode = new URLSearchParams(window.location.search).get("claim");

    if (!claimCode) {
      return;
    }

    const { error } = await supabase
      .from("dealer_vehicle_records")
      .update({ claimed_by_user_id: user.id, claimed_at: new Date().toISOString() })
      .eq("claim_code", claimCode)
      .is("claimed_by_user_id", null);

    if (error) {
      setStatus(`No se pudo reclamar el historial: ${error.message}`);
      return;
    }

    window.history.replaceState({}, "", window.location.pathname);
    setStatus("Historial reclamado. Ya aparece en tu cuenta.");
    void trackActivity("dealer_record_claimed");
    await loadData();
  }

  async function claimMatchingDealerRecord(record: DealerVehicleRecord) {
    if (!supabase || !user) {
      return;
    }

    const { error } = await supabase
      .from("dealer_vehicle_records")
      .update({ claimed_by_user_id: user.id, claimed_at: new Date().toISOString() })
      .eq("id", record.id)
      .is("claimed_by_user_id", null);

    if (error) {
      setStatus(`No se pudo reclamar el historial: ${error.message}`);
      return;
    }

    setStatus("Historial reclamado por telefono/correo. Ya aparece en tu cuenta.");
    void trackActivity("dealer_record_claimed_by_contact", {
      matched_by_phone: Boolean(record.customer_phone && profile?.phone && record.customer_phone === normalizePhoneInput(profile.phone)),
      matched_by_email: Boolean(record.customer_email && user.email && record.customer_email === user.email.trim().toLowerCase()),
    });
    await loadData();
  }

  async function saveDealerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      user_id: user.id,
      business_name: String(formData.get("business_name") ?? "").trim(),
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
    };

    if (!payload.business_name) {
      setStatus("Escribe el nombre del taller para activar modo dealer.");
      return;
    }

    const { data, error } = await supabase
      .from("dealers")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      setStatus(`No se pudo guardar el dealer: ${error.message}`);
      return;
    }

    setDealer(data as Dealer);
    setStatus("Perfil de dealer guardado. Ya puedes registrar servicios y generar links.");
    void trackActivity("dealer_profile_updated");
    await loadDealerData();
  }

  async function saveDealerRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !dealer) {
      setStatus("Primero guarda el perfil del taller.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const mileageUnit = normalizeMileageUnit(formData.get("mileage_unit"));
    const nextServiceApplies = formData.get("next_service_applies") !== "no";
    const mileage = getMileageInKm(
      formData.get("mileage_km"),
      formData.get("mileage_miles"),
      mileageUnit,
    );
    const serviceType = String(formData.get("service_type") ?? "Mantenimiento General");
    const payload = {
      dealer_id: dealer.id,
      customer_name: String(formData.get("customer_name") ?? "").trim() || null,
      customer_phone: normalizePhoneInput(formData.get("customer_phone")),
      customer_email: String(formData.get("customer_email") ?? "").trim().toLowerCase() || null,
      plate: String(formData.get("plate") ?? "").trim().toUpperCase() || null,
      vin: String(formData.get("vin") ?? "").trim().toUpperCase() || null,
      make: String(formData.get("make") ?? "").trim() || null,
      model_line: String(formData.get("model_line") ?? "").trim() || null,
      model_year: parseOptionalNumber(formData.get("model_year")),
      engine: String(formData.get("engine") ?? "").trim() || null,
      mileage,
      mileage_unit: mileageUnit,
      service_type: serviceType,
      service_date: String(formData.get("service_date") ?? today),
      next_service_applies: nextServiceApplies,
      recommended_interval_km: nextServiceApplies
        ? parseOptionalNumber(formData.get("recommended_interval_km")) ?? serviceIntervals[serviceType] ?? null
        : null,
      next_service_date: null,
      estimated_cost: parseOptionalNumber(formData.get("estimated_cost")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    };

    const { data, error } = await supabase
      .from("dealer_vehicle_records")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setStatus(`No se pudo guardar el registro del dealer: ${error.message}`);
      return;
    }

    const record = data as DealerVehicleRecord;
    const claimLink = typeof window === "undefined"
      ? record.claim_code
      : `${window.location.origin}?claim=${record.claim_code}`;

    setLatestClaimLink(claimLink);
    setStatus("Registro guardado. Comparte el link o QR con el cliente.");
    void trackActivity("dealer_service_record_created", {
      service_type: serviceType,
      has_customer_phone: Boolean(payload.customer_phone),
      has_customer_email: Boolean(payload.customer_email),
    });
    form.reset();
    await loadDealerData();
  }

  async function requestDealerRecordChange(record: DealerVehicleRecord, action: "edit" | "delete") {
    if (!supabase || !dealer) {
      return;
    }

    const note = window.prompt(
      action === "delete"
        ? "Explica por que quieres borrar este registro para que el cliente lo revise."
        : "Explica que necesitas cambiar para que el cliente lo revise.",
    );

    if (note === null) {
      return;
    }

    const { error } = await supabase.from("dealer_record_change_requests").insert({
      dealer_id: dealer.id,
      dealer_record_id: record.id,
      requested_action: action,
      requested_payload: action === "edit" ? record : null,
      note: note.trim() || null,
    });

    if (error) {
      setStatus(`No se pudo enviar la solicitud: ${error.message}`);
      return;
    }

    setStatus("Solicitud enviada al perfil del cliente.");
    void trackActivity("dealer_record_change_requested", {
      requested_action: action,
    });
  }

  async function trackActivity(eventName: string, metadata: ActivityMetadata = {}) {
    if (!user) {
      return;
    }

    await trackActivityForUser(user.id, eventName, metadata);
  }

  async function trackActivityForUser(userId: string, eventName: string, metadata: ActivityMetadata = {}) {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("user_activity").insert({
      user_id: userId,
      event_name: eventName,
      page_path: typeof window === "undefined" ? null : window.location.pathname,
      metadata,
    });

    if (error) {
      console.warn("No se pudo registrar actividad:", error.message);
    }
  }

  async function handleAuth(formData: FormData) {
    if (!supabase) {
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setLoading(true);
    setStatus("Procesando acceso...");

    try {
      const result =
        authMode === "signin"
          ? await withTimeout(
              supabase.auth.signInWithPassword({ email, password }),
              12000,
              authTimeoutMessage,
            )
          : await withTimeout(
              supabase.auth.signUp({ email, password }),
              12000,
              authTimeoutMessage,
            );

      if (result.error) {
        setStatus(getErrorMessage(result.error));
        return;
      }

      if (authMode === "signup" && !result.data.session) {
        setStatus("Cuenta creada. Revisa tu correo si Supabase pide confirmacion.");
        return;
      }

      setUser(result.data.user);
      setStatus("Sesion iniciada.");
      if (result.data.user) {
        void trackActivityForUser(result.data.user.id, authMode === "signin" ? "login" : "signup");
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setProfile(null);
    setVehicles([]);
    setServices([]);
    setPendingDealerRecords([]);
    setDealerChangeRequests([]);
    setDealer(null);
    setDealerRecords([]);
    setClaimedDealerRecords([]);
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
      phone: normalizePhoneInput(formData.get("phone")),
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
    void trackActivity("profile_updated", {
      has_birth_date: Boolean(payload.birth_date),
      distance_period: payload.distance_period,
    });
    await loadData();
    setActiveView(vehicles.length ? "dashboard" : "vehicles");
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const ownerName = getProfileName(profile) || user.email || "Sin nombre";
    const currentMileageUnit = normalizeMileageUnit(formData.get("current_mileage_unit"));
    const currentMileage = getMileageInKm(
      formData.get("current_mileage_km"),
      formData.get("current_mileage_miles"),
      currentMileageUnit,
    );
    const payload = {
      user_id: user.id,
      owner_name: ownerName,
      plate: String(formData.get("plate") ?? "").trim().toUpperCase() || null,
      vin: String(formData.get("vin") ?? "").trim().toUpperCase() || null,
      make: String(formData.get("make") ?? "").trim() || null,
      model_line: String(formData.get("model_line") ?? "").trim() || null,
      model_year: parseOptionalNumber(formData.get("model_year")),
      engine: String(formData.get("engine") ?? "").trim() || null,
      usage: String(formData.get("usage") ?? "").trim() || null,
      vehicle_type: String(formData.get("vehicle_type") ?? "").trim() || null,
      seats: parseOptionalNumber(formData.get("seats")),
      color: String(formData.get("color") ?? "").trim() || null,
      cylinders: parseOptionalNumber(formData.get("cylinders")),
      cc: parseOptionalNumber(formData.get("cc")),
      current_mileage: currentMileage,
      current_mileage_unit: currentMileageUnit,
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
    void trackActivity(editingVehicle ? "vehicle_updated" : "vehicle_created", {
      vehicle_type: payload.vehicle_type,
      model_year: payload.model_year,
      has_plate: Boolean(payload.plate),
    });
    await loadData();
    setActiveView("services");
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const serviceType = String(formData.get("service_type") ?? "");
    const tirePositions = formData.getAll("tire_positions").map(String);
    const hadBalancing = String(formData.get("tire_balancing") ?? "no") === "yes";
    const tireInterval = parseOptionalNumber(formData.get("tire_interval_km"));
    const balanceInterval = parseOptionalNumber(formData.get("balance_interval_km"));
    const rawNotes = String(formData.get("notes") ?? "").trim();
    const interval =
      parseOptionalNumber(formData.get("recommended_interval_km")) ??
      serviceIntervals[serviceType] ??
      null;
    const notes = [
      rawNotes,
      serviceType === "Servicio de Llantas" && tirePositions.length ? `Llantas cambiadas: ${tirePositions.join(", ")}` : "",
      serviceType === "Servicio de Llantas" ? `Balanceo: ${hadBalancing ? "Si" : "No"}` : "",
    ].filter(Boolean).join(" | ");
    const payload = {
      user_id: user.id,
      vehicle_id: String(formData.get("vehicle_id") ?? ""),
      service_type: serviceType,
      service_date: String(formData.get("service_date") ?? ""),
      mileage: parseOptionalNumber(formData.get("mileage")),
      recommended_interval_km: serviceType === "Servicio de Llantas" ? tireInterval ?? 50000 : interval,
      estimated_cost: parseOptionalNumber(formData.get("estimated_cost")),
      notes,
    };

    const extraBalancingPayload = serviceType === "Servicio de Llantas" && hadBalancing && !editingService
      ? {
          ...payload,
          service_type: "Alineacion y Balanceo",
          recommended_interval_km: balanceInterval ?? 5000,
          notes: [rawNotes, "Balanceo de llantas"].filter(Boolean).join(" | "),
        }
      : null;

    const result = editingService
      ? await supabase.from("service_records").update(payload).eq("id", editingService.id)
      : await supabase.from("service_records").insert(extraBalancingPayload ? [payload, extraBalancingPayload] : payload);

    if (result.error) {
      setStatus(`No se pudo guardar servicio: ${result.error.message}`);
      return;
    }

    if (payload.mileage) {
      await updateVehicleMileage(payload.vehicle_id, payload.mileage, "km", false);
    }

    form.reset();
    setEditingService(null);
    setSelectedServiceVehicleId(payload.vehicle_id);
    setSelectedServiceType("Servicio de Motor");
    setStatus(editingService ? "Servicio actualizado." : "Servicio guardado.");
    void trackActivity(editingService ? "service_record_updated" : "service_record_created", {
      service_type: payload.service_type,
      has_mileage: Boolean(payload.mileage),
      has_estimated_cost: Boolean(payload.estimated_cost),
    });
    await loadData();
    setActiveView("dashboard");
  }

  async function updateVehicleMileage(vehicleId: string, mileage: number | null, mileageUnit: "km" | "mi" = "km", showMessage = true) {
    if (!supabase || !mileage) {
      return;
    }

    const { error } = await supabase
      .from("vehicles")
      .update({ current_mileage: mileage, current_mileage_unit: mileageUnit })
      .eq("id", vehicleId);

    if (error) {
      setStatus(`No se pudo actualizar kilometraje: ${error.message}`);
      return;
    }

    if (showMessage) {
      setStatus("Kilometraje actualizado.");
      void trackActivity("vehicle_mileage_updated");
      await loadData();
    }
  }

  async function saveVehicleMileage(event: FormEvent<HTMLFormElement>, fallbackVehicleId = "") {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const vehicleId = String(formData.get("vehicle_id") ?? fallbackVehicleId);
    const mileageUnit = normalizeMileageUnit(formData.get("current_mileage_unit"));
    const mileage = getMileageInKm(
      formData.get("current_mileage_km"),
      formData.get("current_mileage_miles"),
      mileageUnit,
    );

    if (!vehicleId) {
      setStatus("Selecciona un vehiculo para actualizar kilometraje.");
      return;
    }

    const selectedVehicle = allVehicles.find((vehicle) => vehicle.id === vehicleId);

    if (selectedVehicle && isDealerVirtualVehicleId(vehicleId)) {
      const createdVehicleId = await createVehicleFromImportedDealerVehicle(selectedVehicle, mileage, mileageUnit);

      if (createdVehicleId) {
        setOverviewVehicleId(createdVehicleId);
        setHistoryVehicleId(createdVehicleId);
      }
      return;
    }

    await updateVehicleMileage(vehicleId, mileage, mileageUnit);
  }

  async function createVehicleFromImportedDealerVehicle(vehicle: Vehicle, mileage: number | null, mileageUnit: "km" | "mi") {
    if (!supabase || !user) {
      return null;
    }

    const ownerName = getProfileName(profile) || user.email || "Sin nombre";
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        user_id: user.id,
        owner_name: ownerName,
        plate: vehicle.plate,
        vin: vehicle.vin,
        make: vehicle.make,
        model_line: vehicle.model_line,
        model_year: vehicle.model_year,
        engine: vehicle.engine,
        usage: vehicle.usage,
        vehicle_type: vehicle.vehicle_type,
        seats: vehicle.seats,
        color: vehicle.color,
        cylinders: vehicle.cylinders,
        cc: vehicle.cc,
        current_mileage: mileage ?? vehicle.current_mileage,
        current_mileage_unit: mileageUnit,
      })
      .select("id")
      .single();

    if (error) {
      setStatus(`No se pudo convertir el vehiculo importado: ${error.message}`);
      return null;
    }

    setStatus("Vehiculo importado agregado a tu cuenta y kilometraje actualizado.");
    void trackActivity("dealer_vehicle_imported", {
      has_mileage: Boolean(mileage ?? vehicle.current_mileage),
    });
    await loadData();
    return data.id as string;
  }

  async function completeUpcomingService(item: ReturnType<typeof getUpcomingServices>[number]) {
    if (!supabase || !user) {
      return;
    }

    const vehicle = vehicles.find((currentVehicle) => currentVehicle.id === item.vehicleId);
    const mileage = vehicle?.current_mileage ?? item.nextMileage;

    if (!mileage) {
      setStatus("Primero actualiza el kilometraje actual del vehiculo.");
      return;
    }

    const { error } = await supabase.from("service_records").insert({
      user_id: user.id,
      vehicle_id: item.vehicleId,
      service_type: item.serviceType,
      service_date: today,
      mileage,
      recommended_interval_km: item.intervalKm,
      estimated_cost: item.estimatedCost,
      notes: "Servicio marcado como realizado desde proximo servicio.",
    });

    if (error) {
      setStatus(`No se pudo registrar servicio realizado: ${error.message}`);
      return;
    }

    setStatus("Servicio registrado y estimacion reiniciada.");
    void trackActivity("upcoming_service_completed", {
      service_type: item.serviceType,
      interval_km: item.intervalKm,
    });
    await loadData();
  }

  async function saveWishlistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const feedback = String(formData.get("feedback") ?? "").trim();

    if (feedback.length < 3) {
      setStatus("Escribe una idea un poco mas detallada para la wishlist.");
      return;
    }

    const { error } = await supabase.from("wishlist_items").insert({
      user_id: user.id,
      feedback,
    });

    if (error) {
      setStatus(`No se pudo guardar wishlist: ${error.message}`);
      return;
    }

    form.reset();
    setStatus("Gracias. Tu idea fue guardada en la wishlist.");
    void trackActivity("wishlist_item_created", {
      feedback_length: feedback.length,
    });
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
    void trackActivity("vehicle_deleted");
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
    void trackActivity("service_record_deleted", {
      service_type: service.service_type,
    });
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

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAuth(new FormData(event.currentTarget));
            }}
          >
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

      <section className="mb-5 grid gap-2 rounded-lg border border-white/12 bg-[#1d2024] p-2 shadow-xl shadow-black/20 sm:grid-cols-2">
        <TabButton active={appMode === "customer"} onClick={() => setAppMode("customer")}>
          Cliente
        </TabButton>
        <TabButton active={appMode === "dealer"} onClick={() => setAppMode("dealer")}>
          Dealer
        </TabButton>
      </section>

      {appMode === "dealer" ? (
        <>
          <DealerWorkspace
            dealer={dealer}
            records={dealerRecords}
            latestClaimLink={latestClaimLink}
            status={status}
            onSaveDealerProfile={saveDealerProfile}
            onSaveDealerRecord={saveDealerRecord}
            onRequestRecordChange={requestDealerRecordChange}
          />
          <StatusMessage message={status} />
        </>
      ) : (
        <>
      <MileageQuickUpdate vehicles={allVehicles} onSubmit={saveVehicleMileage} />

      <section className="mb-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <VehicleOverview
          vehicles={allVehicles}
          services={allServices}
          nextMonthCost={nextMonthCost}
          annualCost={annualCost}
          selectedVehicle={overviewVehicle}
          selectedVehicleId={overviewVehicle?.id ?? ""}
          onSelectVehicle={setOverviewVehicleId}
        />
        <ProfileSummary profile={profile} userEmail={user.email ?? ""} dailyKm={dailyKm} onEdit={() => setActiveView("profile")} />
      </section>

      <section className="mb-5 grid gap-2 rounded-lg border border-white/12 bg-[#1d2024] p-2 shadow-xl shadow-black/20 md:grid-cols-5">
        <TabButton active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")}>
          Dashboard
        </TabButton>
        <TabButton active={activeView === "profile"} onClick={() => setActiveView("profile")}>
          Perfil
        </TabButton>
        <TabButton active={activeView === "vehicles"} onClick={() => setActiveView("vehicles")}>
          Vehiculos
        </TabButton>
        <TabButton active={activeView === "services"} onClick={() => setActiveView("services")}>
          Servicios
        </TabButton>
        <TabButton active={activeView === "vehicle3d"} onClick={() => setActiveView("vehicle3d")}>
          Plano tecnico
        </TabButton>
      </section>

      <StepBanner activeView={activeView} hasVehicle={vehicles.length > 0} />

      {activeView === "profile" || activeView === "vehicles" || activeView === "services" ? (
        <>
      <section className={activeView === "profile" || activeView === "vehicles" ? "mb-5" : "hidden"}>
        {activeView === "profile" ? (
        <Panel eyebrow="Usuario" title="Perfil y recorrido" id="perfil">
          <form className="grid gap-4" onSubmit={saveProfile} key={profile?.user_id ?? "profile"}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Nombre" name="first_name" defaultValue={profile?.first_name ?? ""} />
              <TextField label="Apellido" name="last_name" defaultValue={profile?.last_name ?? ""} />
              <TextField label="Telefono" name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
              <SelectField label="Genero" name="gender" defaultValue={profile?.gender ?? ""}>
                <option value="">Selecciona genero</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </SelectField>
              <TextField label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={profile?.birth_date ?? ""} />
              <TextField label="Km recorridos diarios" name="driving_distance" type="number" min={1} required defaultValue={profile?.driving_distance ?? ""} />
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
        ) : null}

        {activeView === "vehicles" ? (
        <Panel eyebrow="Registro" title={editingVehicle ? "Editar vehiculo" : "Datos del vehiculo"} id="vehiculo-form">
          <form className="grid gap-4" onSubmit={saveVehicle} key={editingVehicle?.id ?? "new-vehicle"}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Placa" name="plate" defaultValue={editingVehicle?.plate ?? ""} />
              <TextField label="VIN" name="vin" maxLength={17} defaultValue={editingVehicle?.vin ?? ""} />
              <TextField label="Marca" name="make" defaultValue={editingVehicle?.make ?? ""} />
              <TextField label="Linea" name="model_line" defaultValue={editingVehicle?.model_line ?? ""} />
              <TextField label="Modelo" name="model_year" type="number" min={1900} defaultValue={editingVehicle?.model_year ?? ""} />
              <TextField label="Motor" name="engine" defaultValue={editingVehicle?.engine ?? ""} />
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
              <TextField label="Cilindros" name="cylinders" type="number" min={0} step="any" defaultValue={editingVehicle?.cylinders ?? ""} />
              <TextField label="CC / litros" name="cc" type="number" min={0} step="any" defaultValue={editingVehicle?.cc ?? ""} />
              <SelectField label="Unidad principal" name="current_mileage_unit" defaultValue={editingVehicle?.current_mileage_unit ?? "km"}>
                <option value="km">Kilometros</option>
                <option value="mi">Millas</option>
              </SelectField>
              <TextField label="Kilometraje actual (km)" name="current_mileage_km" type="number" min={0} step="any" defaultValue={editingVehicle?.current_mileage ?? ""} />
              <TextField label="Millaje actual (mi)" name="current_mileage_miles" type="number" min={0} step="any" defaultValue={editingVehicle?.current_mileage ? kmToMiles(editingVehicle.current_mileage).toFixed(1) : ""} />
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
        ) : null}
      </section>

      <section className={activeView === "services" ? "mb-5" : "hidden"}>
        <Panel eyebrow="Servicio" title={editingService ? "Editar servicio" : "Registrar servicio"} id="servicio-form">
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
            {selectedServiceType === "Servicio de Llantas" ? (
              <div className="grid gap-4 rounded-lg border border-white/12 bg-white/5 p-4 md:grid-cols-2">
                <fieldset className="grid gap-2 text-sm font-bold text-zinc-200">
                  <legend>Llantas cambiadas</legend>
                  {["Delantera izquierda", "Delantera derecha", "Trasera izquierda", "Trasera derecha"].map((position) => (
                    <label key={position} className="flex items-center gap-2 font-bold text-zinc-300">
                      <input className="h-4 w-4 accent-red-600" type="checkbox" name="tire_positions" value={position} />
                      {position}
                    </label>
                  ))}
                </fieldset>
                <div className="grid gap-4">
                  <SelectField label="Incluyo balanceo" name="tire_balancing" defaultValue="no">
                    <option value="no">No</option>
                    <option value="yes">Si</option>
                  </SelectField>
                  <TextField label="Proximo balanceo (km)" name="balance_interval_km" type="number" min={0} defaultValue={5000} />
                  <TextField label="Proximo cambio de llantas (km)" name="tire_interval_km" type="number" min={0} defaultValue={50000} />
                </div>
              </div>
            ) : null}
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

      {activeView === "dashboard" ? (
        <>
      {dealerChangeRequests.length ? (
      <section className="mb-5">
        <Panel eyebrow="Revision" title="Solicitudes de dealers">
          <div className="grid gap-3 md:grid-cols-2">
            {dealerChangeRequests.map((request) => (
              <RecordCard key={request.id}>
                <strong>{request.requested_action === "delete" ? "Solicitud para borrar registro" : "Solicitud para cambiar registro"}</strong>
                <span>{request.note || "Sin comentario del dealer."}</span>
                <span>Estado: {request.status}</span>
                <span>{formatDate(request.created_at.slice(0, 10))}</span>
              </RecordCard>
            ))}
          </div>
        </Panel>
      </section>
      ) : null}

      {pendingDealerRecords.length ? (
      <section className="mb-5">
        <Panel eyebrow="Pendiente" title="Historial encontrado para ti">
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-950/25 p-4 text-sm font-bold text-red-100">
            Encontramos registros creados por dealers con tu telefono o correo. Reclama solo los que sean tuyos. Para que alimenten tu dashboard, registra el vehiculo con la misma placa o VIN.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingDealerRecords.map((record) => (
              <RecordCard key={record.id}>
                <strong><IconText icon="🔎">{dealerRecordVehicleLabel(record)}</IconText></strong>
                <span>{record.service_type} - {formatDate(record.service_date)}</span>
                <span>{record.dealers?.business_name || "Dealer Nyfrom"}{record.dealers?.contact_phone ? ` - ${record.dealers.contact_phone}` : ""}</span>
                <span>{record.mileage ? formatMileageBothUnits(record.mileage) : "Kilometraje pendiente"}</span>
                <span>Costo registrado: {formatMoney(record.estimated_cost)}</span>
                <button
                  className="mt-3 min-h-11 rounded-lg bg-red-600 px-4 font-black text-white"
                  type="button"
                  onClick={() => void claimMatchingDealerRecord(record)}
                >
                  Reclamar historial
                </button>
              </RecordCard>
            ))}
          </div>
        </Panel>
      </section>
      ) : null}

      <section className="mb-5">
        <Panel eyebrow="Estado" title="Vida util por servicio">
          <ServiceHealthList items={healthItems} />
        </Panel>
      </section>

      <section className="mb-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Proximo servicio" title="🧰 Proximo servicio" id="proximos-servicios">
          <div className="mb-4">
            <SelectField label="Filtrar por vehiculo" name="upcoming_filter" value={historyVehicleId} onChange={(event) => setHistoryVehicleId(event.currentTarget.value)}>
              <option value="all">Todos los vehiculos</option>
              {allVehicles.map((vehicle) => (
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
                  <span>Costo estimado: {formatMoney(item.estimatedCost)}</span>
                  <span>Base: {item.intervalKm.toLocaleString("es-GT")} km / {dailyKm.toFixed(1)} km diarios</span>
                  <strong className="mt-3 block rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-lg text-red-200">
                    Fecha estimada: {formatDate(item.estimatedDate)}
                  </strong>
                  {isDealerVirtualVehicleId(item.vehicleId) ? (
                    <p className="mt-3 rounded-lg border border-white/12 bg-white/5 p-3 text-sm font-bold text-zinc-400">
                      Importado de dealer. Registra este vehiculo en tu cuenta para marcar servicios realizados manualmente.
                    </p>
                  ) : (
                    <ActionRow>
                      <button type="button" onClick={() => void completeUpcomingService(item)}>
                        <ButtonLabel icon="✓">Marcar realizado</ButtonLabel>
                      </button>
                    </ActionRow>
                  )}
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
              {allVehicles.map((vehicle) => (
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
                  {isDealerImportedService(service) ? (
                    <span className="font-bold text-red-200">Importado de dealer</span>
                  ) : (
                    <ActionRow>
                      <button type="button" onClick={() => {
                        setEditingService(service);
                        setSelectedServiceType(service.service_type);
                        setSelectedServiceVehicleId(service.vehicle_id);
                        setActiveView("services");
                      }}><ButtonLabel icon="✏️">Editar</ButtonLabel></button>
                      <button type="button" onClick={() => void deleteService(service)}><ButtonLabel icon="🗑️">Borrar</ButtonLabel></button>
                    </ActionRow>
                  )}
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
            {allVehicles.length ? (
              allVehicles.map((vehicle) => (
                <RecordCard key={vehicle.id}>
                  <strong><IconText icon={vehicleIcon(vehicle)}>{vehicleLabel(vehicle)}</IconText></strong>
                  <span>VIN: {vehicle.vin || "Pendiente"}</span>
                  <span>
                    Motor: {vehicle.engine || "Pendiente"}
                    {vehicle.cylinders ? ` - ${vehicle.cylinders} cilindros` : ""}
                    {vehicle.cc ? ` - ${formatEngineDisplacement(vehicle.cc)}` : ""}
                  </span>
                  <span>
                    {vehicle.color ? `Color: ${vehicle.color}` : "Color pendiente"}
                    {vehicle.usage ? ` - Uso: ${vehicle.usage}` : ""}
                    {vehicle.vehicle_type ? ` - Tipo: ${vehicle.vehicle_type}` : ""}
                    {vehicle.seats ? ` - ${vehicle.seats} asientos` : ""}
                  </span>
                  {isDealerVirtualVehicleId(vehicle.id) ? (
                    <span className="font-bold text-red-200">Importado de dealer</span>
                  ) : (
                    <ActionRow>
                      <button type="button" onClick={() => {
                        setEditingVehicle(vehicle);
                        setActiveView("vehicles");
                      }}><ButtonLabel icon="✏️">Editar</ButtonLabel></button>
                      <button type="button" onClick={() => void deleteVehicle(vehicle)}><ButtonLabel icon="🗑️">Borrar</ButtonLabel></button>
                    </ActionRow>
                  )}
                </RecordCard>
              ))
            ) : (
              <EmptyState text="Aun no hay vehiculos registrados." />
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-5">
        <Panel eyebrow="Wishlist" title="Que te gustaria ver en Auto Hub">
          <form className="grid gap-4" onSubmit={saveWishlistItem}>
            <p className="max-w-3xl text-sm font-bold text-zinc-400">
              Cuéntanos qué te gustaría que tuviera la app. Esta sección nos ayuda a recibir feedback directo
              para decidir las próximas funciones.
            </p>
            <textarea
              className="min-h-28 rounded-lg border border-white/12 bg-black/25 px-4 py-3 text-white outline-none focus:border-red-300"
              name="feedback"
              maxLength={1000}
              placeholder="Ejemplo: recordatorios por WhatsApp, fotos de facturas, alertas por placa, control de combustible..."
              required
            />
            <button className="min-h-12 w-fit rounded-lg bg-red-600 px-5 font-black text-white" type="submit">
              Guardar idea
            </button>
          </form>
        </Panel>
      </section>
        </>
      ) : null}

      {activeView === "vehicle3d" ? (
        <section className="mb-5">
          <Panel eyebrow="Plano tecnico" title="Esquema del vehiculo">
            <VehicleBlueprintView items={healthItems} services={allServices} vehicles={allVehicles} />
          </Panel>
        </section>
      ) : null}

      <StatusMessage message={status} />
        </>
      )}
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

function DealerWorkspace({
  dealer,
  records,
  latestClaimLink,
  status,
  onSaveDealerProfile,
  onSaveDealerRecord,
  onRequestRecordChange,
}: {
  dealer: Dealer | null;
  records: DealerVehicleRecord[];
  latestClaimLink: string;
  status: string;
  onSaveDealerProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSaveDealerRecord: (event: FormEvent<HTMLFormElement>) => void;
  onRequestRecordChange: (record: DealerVehicleRecord, action: "edit" | "delete") => void;
}) {
  const claimedRecords = records.filter((record) => record.claimed_by_user_id);
  const openRecords = records.filter((record) => !record.claimed_by_user_id);
  const customerOptions = getDealerCustomerOptions(records);
  const vehicleOptions = getDealerVehicleOptions(records);
  const monthRevenue = records
    .filter((record) => isThisMonth(record.service_date))
    .reduce((sum, record) => sum + Number(record.estimated_cost ?? 0), 0);

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Panel eyebrow="Dealer Hub" title={dealer?.business_name || "Activa tu taller"}>
          <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
            <MetricCard icon="🧰" label="Servicios" value={records.length.toString()} />
            <MetricCard icon="✓" label="Reclamados" value={claimedRecords.length.toString()} />
            <MetricCard icon="💰" label="Mes actual" value={formatMoney(monthRevenue)} />
          </div>
          <p className="mt-5 text-sm font-bold text-zinc-400">
            Registra el servicio, entrega el link al cliente y su historial queda listo para reclamarlo en Nyfrom.
          </p>
        </Panel>

        <Panel eyebrow="Perfil dealer" title="Datos del taller">
          <form className="grid gap-4" onSubmit={onSaveDealerProfile}>
            <TextField label="Nombre del taller" name="business_name" required defaultValue={dealer?.business_name ?? ""} />
            <TextField label="Telefono" name="contact_phone" defaultValue={dealer?.contact_phone ?? ""} />
            <TextField label="Direccion" name="address" defaultValue={dealer?.address ?? ""} />
            <button className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white" type="submit">
              Guardar dealer
            </button>
          </form>
          <StatusMessage message={status} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel eyebrow="Intake" title="Registrar servicio para cliente">
          <form className="grid gap-4" onSubmit={onSaveDealerRecord}>
            <datalist id="dealer-customer-names">
              {customerOptions.map((customer) => <option key={customer.key} value={customer.name} />)}
            </datalist>
            <datalist id="dealer-customer-phones">
              {customerOptions.map((customer) => customer.phone ? <option key={customer.key} value={customer.phone} /> : null)}
            </datalist>
            <datalist id="dealer-customer-emails">
              {customerOptions.map((customer) => customer.email ? <option key={customer.key} value={customer.email} /> : null)}
            </datalist>
            <datalist id="dealer-vehicle-plates">
              {vehicleOptions.map((vehicle) => vehicle.plate ? <option key={vehicle.key} value={vehicle.plate} /> : null)}
            </datalist>
            <datalist id="dealer-vehicle-vins">
              {vehicleOptions.map((vehicle) => vehicle.vin ? <option key={vehicle.key} value={vehicle.vin} /> : null)}
            </datalist>
            <datalist id="dealer-vehicle-makes">
              {vehicleOptions.map((vehicle) => vehicle.make ? <option key={vehicle.key} value={vehicle.make} /> : null)}
            </datalist>
            <datalist id="dealer-vehicle-lines">
              {vehicleOptions.map((vehicle) => vehicle.modelLine ? <option key={vehicle.key} value={vehicle.modelLine} /> : null)}
            </datalist>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Cliente" name="customer_name" list="dealer-customer-names" />
              <TextField label="Telefono cliente" name="customer_phone" list="dealer-customer-phones" />
              <TextField label="Correo cliente" name="customer_email" type="email" list="dealer-customer-emails" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Placa" name="plate" list="dealer-vehicle-plates" />
              <TextField label="VIN" name="vin" maxLength={17} list="dealer-vehicle-vins" />
              <TextField label="Marca" name="make" list="dealer-vehicle-makes" />
              <TextField label="Linea" name="model_line" list="dealer-vehicle-lines" />
              <TextField label="Modelo" name="model_year" type="number" min={1900} />
              <TextField label="Motor" name="engine" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Tipo de servicio" name="service_type" defaultValue="Mantenimiento General">
                {serviceTypes.map((type) => <option key={type} value={type}>{serviceIcon(type)} {type}</option>)}
              </SelectField>
              <TextField label="Fecha" name="service_date" type="date" required defaultValue={today} />
              <SelectField label="Unidad principal" name="mileage_unit" defaultValue="km">
                <option value="km">Kilometros</option>
                <option value="mi">Millas</option>
              </SelectField>
              <TextField label="Monto cobrado (Q)" name="estimated_cost" type="number" min={0} step="any" />
              <TextField label="Kilometraje (km)" name="mileage_km" type="number" min={0} step="any" />
              <TextField label="Millaje (mi)" name="mileage_miles" type="number" min={0} step="any" />
              <SelectField label="Proximo servicio" name="next_service_applies" defaultValue="yes">
                <option value="yes">Si aplica</option>
                <option value="no">No aplica</option>
              </SelectField>
              <TextField label="Intervalo recomendado (km)" name="recommended_interval_km" type="number" min={0} defaultValue={serviceIntervals["Mantenimiento General"]} />
            </div>
            <p className="text-xs font-bold text-zinc-500">
              La fecha exacta del proximo servicio la calcula el perfil del cliente segun su recorrido diario.
            </p>
            <label className="grid gap-2 text-sm font-bold text-zinc-200">
              Notas del servicio
              <textarea
                className="min-h-28 rounded-lg border border-white/12 bg-black/25 px-4 py-3 text-white outline-none focus:border-red-300"
                name="notes"
                placeholder="Repuestos, diagnostico, garantia, recomendacion o proxima visita."
              />
            </label>
            {!dealer ? (
              <p className="rounded-lg border border-red-400/30 bg-red-950/25 p-3 text-sm font-bold text-red-100">
                Guarda primero los datos del taller para activar este formulario.
              </p>
            ) : null}
            <button className="min-h-12 rounded-lg bg-red-600 px-5 font-black text-white disabled:opacity-50" type="submit" disabled={!dealer}>
              Guardar y generar link
            </button>
          </form>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel eyebrow="Cliente" title="Link de reclamo">
            {latestClaimLink ? (
              <ClaimLinkCard claimLink={latestClaimLink} />
            ) : (
              <EmptyState text="Cuando guardes un servicio, aqui aparecera el link para que el cliente reclame su historial." />
            )}
          </Panel>

          <Panel eyebrow="Pendientes" title="Clientes por reclamar">
            <div className="grid max-h-[420px] gap-3 overflow-auto pr-1">
              {openRecords.length ? (
                openRecords.map((record) => (
                  <RecordCard key={record.id}>
                    <strong>{dealerRecordVehicleLabel(record)}</strong>
                    <span>{record.customer_name || record.customer_phone || record.customer_email || "Cliente pendiente"}</span>
                    <span>{record.service_type} - {formatDate(record.service_date)}</span>
                    <span>Codigo: {record.claim_code}</span>
                  </RecordCard>
                ))
              ) : (
                <EmptyState text="No hay registros pendientes de reclamo." />
              )}
            </div>
          </Panel>
        </div>
      </section>

      <Panel eyebrow="Historial dealer" title="Servicios registrados">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {records.length ? (
            records.map((record) => (
              <RecordCard key={record.id}>
                <strong><IconText icon={record.claimed_by_user_id ? "✓" : "⏳"}>{dealerRecordVehicleLabel(record)}</IconText></strong>
                <span>{record.customer_name || record.customer_phone || record.customer_email || "Cliente pendiente"}</span>
                <span>{record.service_type} - {formatDate(record.service_date)}</span>
                <span>{record.mileage ? formatMileageBothUnits(record.mileage) : "Kilometraje pendiente"}</span>
                <span>{record.claimed_by_user_id ? "Reclamado por cliente" : "Pendiente de reclamo"}</span>
                {record.claimed_by_user_id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-md border border-white/12 px-3 py-2 font-bold text-white" type="button" onClick={() => onRequestRecordChange(record, "edit")}>
                      Solicitar cambio
                    </button>
                    <button className="rounded-md border border-red-400/40 px-3 py-2 font-bold text-red-100" type="button" onClick={() => onRequestRecordChange(record, "delete")}>
                      Solicitar borrar
                    </button>
                  </div>
                ) : null}
              </RecordCard>
            ))
          ) : (
            <EmptyState text="Todavia no hay servicios registrados por este dealer." />
          )}
        </div>
      </Panel>
    </div>
  );
}

function ClaimLinkCard({ claimLink }: { claimLink: string }) {
  const claimCode = claimLink.includes("claim=") ? claimLink.split("claim=")[1] : claimLink;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-red-300/30 bg-red-950/25 p-5 text-center">
        <p className="text-xs font-black uppercase text-red-200">Codigo de reclamo</p>
        <strong className="mt-2 block break-all font-mono text-xl text-white">{claimCode}</strong>
      </div>
      <div className="rounded-lg border border-white/12 bg-black/25 p-4">
        <p className="break-all text-sm font-bold text-zinc-200">{claimLink}</p>
      </div>
      <p className="text-sm font-bold text-zinc-400">
        Comparte este link por WhatsApp o abrelo en el telefono del cliente para reclamar el historial.
      </p>
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

function MileageQuickUpdate({
  vehicles,
  onSubmit,
}: {
  vehicles: Vehicle[];
  onSubmit: (event: FormEvent<HTMLFormElement>, fallbackVehicleId?: string) => void;
}) {
  const firstVehicle = vehicles[0];
  const [selectedVehicleId, setSelectedVehicleId] = useState(firstVehicle?.id ?? "");
  const effectiveSelectedVehicleId = vehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    ? selectedVehicleId
    : firstVehicle?.id ?? "";
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === effectiveSelectedVehicleId) ?? firstVehicle;
  const selectedVehicleMileage = selectedVehicle?.current_mileage ?? null;

  if (!firstVehicle) {
    return null;
  }

  return (
    <section className="mb-5 rounded-lg border border-red-400/30 bg-red-950/25 p-5 shadow-xl shadow-red-950/20">
      <form className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1.4fr]" onSubmit={(event) => onSubmit(event)}>
        <div>
          <p className="text-xs font-black uppercase text-red-200">Kilometraje actual</p>
          <h2 className="mt-1 text-2xl font-black text-white">Actualiza km o millas</h2>
          <p className="mt-2 text-sm font-bold text-red-100/80">
            {formatMileageBothUnits(selectedVehicleMileage)}
          </p>
        </div>
        <div className="grid gap-3">
          <select
            className="min-h-14 rounded-lg border border-red-300/30 bg-black/35 px-4 text-base font-black text-white outline-none focus:border-red-200"
            name="vehicle_id"
            value={effectiveSelectedVehicleId}
            onChange={(event) => setSelectedVehicleId(event.currentTarget.value)}
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
          <select
            key={selectedVehicle?.id ?? "mileage-unit"}
            className="min-h-14 rounded-lg border border-red-300/30 bg-black/35 px-4 text-base font-black text-white outline-none focus:border-red-200"
            name="current_mileage_unit"
            defaultValue={selectedVehicle?.current_mileage_unit ?? "km"}
          >
            <option value="km">Guardar desde kilometros</option>
            <option value="mi">Guardar desde millas</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="min-h-14 min-w-0 rounded-lg border border-red-300/30 bg-black/35 px-4 text-lg font-black text-white outline-none focus:border-red-200"
            name="current_mileage_km"
            type="number"
            min={0}
            step="any"
            placeholder={selectedVehicleMileage ? `${selectedVehicleMileage.toLocaleString("es-GT")} km` : "Km"}
          />
          <input
            className="min-h-14 min-w-0 rounded-lg border border-red-300/30 bg-black/35 px-4 text-lg font-black text-white outline-none focus:border-red-200"
            name="current_mileage_miles"
            type="number"
            min={0}
            step="any"
            placeholder={selectedVehicleMileage ? `${kmToMiles(selectedVehicleMileage).toLocaleString("es-GT", { maximumFractionDigits: 1 })} mi` : "Millas"}
          />
          <button className="min-h-14 rounded-lg bg-red-600 px-6 text-base font-black text-white shadow-lg shadow-red-950/30" type="submit">
            Actualizar
          </button>
        </div>
      </form>
    </section>
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
  selectedVehicle,
  selectedVehicleId,
  onSelectVehicle,
}: {
  vehicles: Vehicle[];
  services: ServiceRecord[];
  nextMonthCost: number;
  annualCost: number;
  selectedVehicle: Vehicle | null;
  selectedVehicleId: string;
  onSelectVehicle: (vehicleId: string) => void;
}) {
  const featuredVehicle = selectedVehicle ?? vehicles[0];
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
        {vehicles.length > 1 ? (
          <div className="mb-4 max-w-xl">
            <select
              className="min-h-12 w-full rounded-lg border border-white/12 bg-black/25 px-4 font-black text-white outline-none focus:border-red-300"
              value={selectedVehicleId || featuredVehicle?.id || ""}
              onChange={(event) => onSelectVehicle(event.currentTarget.value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
            <SummaryLine label="VIN" value={featuredVehicle.vin || "Pendiente"} />
            <SummaryLine label="Motor" value={featuredVehicle.engine || "Pendiente"} />
            <SummaryLine label="Color" value={featuredVehicle.color || "Pendiente"} />
            <SummaryLine label="Kilometraje" value={formatMileageBothUnits(featuredVehicle.current_mileage)} />
            <SummaryLine label="Historial" value={`${featuredServices} servicios`} />
          </dl>
        ) : (
          <p className="mt-6 max-w-xl text-lg text-zinc-300">
            Usa la pestana Registrar datos para guardar lo que tengas a mano del vehiculo.
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
  onEdit,
}: {
  profile: Profile | null;
  userEmail: string;
  dailyKm: number;
  onEdit: () => void;
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
      <button
        className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-white/12 px-4 font-black text-white"
        type="button"
        onClick={onEdit}
      >
        Editar perfil
      </button>
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

function StepBanner({ activeView, hasVehicle }: { activeView: AppView; hasVehicle: boolean }) {
  const copy: Record<AppView, { eyebrow: string; title: string; body: string }> = {
    dashboard: {
      eyebrow: "Dashboard",
      title: "Resumen general de tu Auto Hub",
      body: "Aqui ves tus vehiculos, costos, proximos servicios e historial reciente.",
    },
    profile: {
      eyebrow: "Paso 1",
      title: "Completa tu perfil de recorrido",
      body: "Solo los kilometros diarios son obligatorios. Los demas datos ayudan a personalizar tu cuenta.",
    },
    vehicles: {
      eyebrow: "Paso 2",
      title: "Registra tu vehiculo",
      body: "Guarda la informacion base del vehiculo una sola vez. Luego podras volver aqui para agregar o editar vehiculos.",
    },
    services: {
      eyebrow: "Paso 3",
      title: hasVehicle ? "Registra servicios y mantenimientos" : "Primero necesitas agregar un vehiculo",
      body: hasVehicle
        ? "Selecciona un vehiculo, registra el servicio y Auto Hub calculara proximas recomendaciones."
        : "Ve a Vehiculos para guardar tu primer registro antes de crear servicios.",
    },
    vehicle3d: {
      eyebrow: "Plano tecnico",
      title: "Revisa el estado grafico del vehiculo",
      body: "Esta vista muestra motor, llantas, frenos y amortiguadores en un esquema simple por posicion.",
    },
  };

  const item = copy[activeView];

  return (
    <section className="mb-5 rounded-lg border border-white/12 bg-white/5 p-5">
      <p className="mb-2 text-xs font-black uppercase text-red-300">{item.eyebrow}</p>
      <h2 className="text-2xl font-black">{item.title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-bold text-zinc-400">{item.body}</p>
    </section>
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
  step,
  list,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  step?: number | "any";
  list?: string;
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
        step={step}
        list={list}
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

function ServiceHealthList({ items }: { items: ReturnType<typeof getServiceHealth> }) {
  if (!items.length) {
    return <EmptyState text="Registra servicios con kilometraje para ver vida util por servicio." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.serviceType} className="rounded-lg border border-white/12 bg-white/5 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <strong>{item.serviceType}</strong>
            <span className={`font-black ${item.textColor}`}>{item.percent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/40">
            <div className={`h-full rounded-full ${item.barColor}`} style={{ width: `${item.percent}%` }} />
          </div>
          <p className="mt-2 text-sm font-bold text-zinc-400">
            Restante: {item.remainingKm.toLocaleString("es-GT")} km de {item.intervalKm.toLocaleString("es-GT")} km
          </p>
        </article>
      ))}
    </div>
  );
}

function VehicleBlueprintView({
  items,
  services,
  vehicles,
}: {
  items: ReturnType<typeof getServiceHealth>;
  services: ServiceRecord[];
  vehicles: Vehicle[];
}) {
  const [filter, setFilter] = useState("all");
  const parts = getBlueprintParts(items, services, vehicles);
  const visibleParts = parts.filter((part) => filter === "all" || part.group === filter);
  const markerById = Object.fromEntries(parts.map((part) => [part.id, part])) as Record<string, BlueprintPart>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-2 text-sm font-bold text-zinc-200">
          Ver componentes
          <select
            className="min-h-12 min-w-64 rounded-lg border border-white/12 bg-black/25 px-4 text-white outline-none focus:border-cyan-300"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todo el vehiculo</option>
            <option value="motor">Motor</option>
            <option value="tires">Llantas</option>
            <option value="brakes">Frenos</option>
            <option value="suspension">Suspension</option>
          </select>
        </label>
        <p className="max-w-xl text-sm font-bold text-zinc-400">
          Cada punto muestra vida estimada por componente. Si aun no existe registro por posicion, la app usa el
          porcentaje general de ese servicio.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="relative min-h-[620px] overflow-hidden rounded-lg border border-white/15 bg-zinc-100 shadow-2xl shadow-black/30">
          <svg
            className="absolute inset-4 h-[calc(100%-32px)] w-[calc(100%-32px)] text-zinc-700"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 1100 620"
          >
            <g opacity="0.95" strokeWidth="2.4">
              <text x="42" y="36" fill="currentColor" stroke="none" className="text-[22px] font-black">Lateral</text>
              <path d="M54 218h52c8-46 41-73 87-73 42 0 75 25 87 67h166c10-42 43-67 86-67 42 0 73 24 86 66h31l14-58-42-15-69-72H256c-72 0-126 26-165 83l-32 12-5 57Z" />
              <path d="M151 141c39-46 85-66 146-66h179l64 66" />
              <path d="M258 76l-28 66" />
              <path d="M357 76v67" />
              <path d="M474 79l34 63" />
              <path d="M72 181h560" />
              <path d="M303 150h109v58H303z" />
              <path d="M180 152l26 34m344-22h41" />
              <BlueprintWheel cx={193} cy={218} part={markerById.tireRearLeft} active={isPartVisible(markerById.tireRearLeft, filter)} compact />
              <BlueprintWheel cx={531} cy={218} part={markerById.tireFrontLeft} active={isPartVisible(markerById.tireFrontLeft, filter)} compact />
              <BlueprintPartMarker x={570} y={170} part={markerById.motor} active={isPartVisible(markerById.motor, filter)} />

              <text x="710" y="36" fill="currentColor" stroke="none" className="text-[22px] font-black">Frente</text>
              <path d="M704 257h253l15-38-9-86-36-57H735l-36 57-9 86 14 38Z" />
              <path d="M738 86h187l22 48H716l22-48Z" />
              <path d="M736 154h190l-12 52H748l-12-52Z" />
              <path d="M766 177h130" />
              <path d="M730 218h205" />
              <path d="M694 162h-42m314 0h42" />
              <circle cx="733" cy="203" r="18" />
              <circle cx="927" cy="203" r="18" />
              <BlueprintPartMarker x={716} y={255} part={markerById.tireFrontLeft} active={isPartVisible(markerById.tireFrontLeft, filter)} />
              <BlueprintPartMarker x={944} y={255} part={markerById.tireFrontRight} active={isPartVisible(markerById.tireFrontRight, filter)} />
              <BlueprintPartMarker x={760} y={235} part={markerById.brakesFrontLeft} active={isPartVisible(markerById.brakesFrontLeft, filter)} />
              <BlueprintPartMarker x={900} y={235} part={markerById.brakesFrontRight} active={isPartVisible(markerById.brakesFrontRight, filter)} />

              <text x="42" y="330" fill="currentColor" stroke="none" className="text-[22px] font-black">Planta</text>
              <path d="M72 443c0-48 28-82 73-98h420c48 16 73 50 73 98s-25 82-73 98H145c-45-16-73-50-73-98Z" />
              <path d="M112 384h48v118h-48" />
              <path d="M552 384h48v118h-48" />
              <path d="M186 370h110l18 42v63l-18 42H186" />
              <path d="M421 370H311l-18 42v63l18 42h110" />
              <rect x="322" y="410" width="68" height="68" rx="10" />
              <path d="M82 422h55m0 42H82" />
              <path d="M573 422h55m-55 42h55" />
              <text x="92" y="572" fill="currentColor" stroke="none" className="text-[18px] font-black">BACK</text>
              <text x="546" y="572" fill="currentColor" stroke="none" className="text-[18px] font-black">FRONT</text>
              <BlueprintPartMarker x={570} y={443} part={markerById.motor} active={isPartVisible(markerById.motor, filter)} />
              <BlueprintPartMarker x={120} y={390} part={markerById.tireRearLeft} active={isPartVisible(markerById.tireRearLeft, filter)} />
              <BlueprintPartMarker x={120} y={496} part={markerById.tireRearRight} active={isPartVisible(markerById.tireRearRight, filter)} />
              <BlueprintPartMarker x={594} y={390} part={markerById.tireFrontLeft} active={isPartVisible(markerById.tireFrontLeft, filter)} />
              <BlueprintPartMarker x={594} y={496} part={markerById.tireFrontRight} active={isPartVisible(markerById.tireFrontRight, filter)} />
              <BlueprintPartMarker x={120} y={390} part={markerById.suspensionRearLeft} active={isPartVisible(markerById.suspensionRearLeft, filter)} />
              <BlueprintPartMarker x={120} y={496} part={markerById.suspensionRearRight} active={isPartVisible(markerById.suspensionRearRight, filter)} />
              <BlueprintPartMarker x={594} y={390} part={markerById.suspensionFrontLeft} active={isPartVisible(markerById.suspensionFrontLeft, filter)} />
              <BlueprintPartMarker x={594} y={496} part={markerById.suspensionFrontRight} active={isPartVisible(markerById.suspensionFrontRight, filter)} />
              <BlueprintPartMarker x={120} y={390} part={markerById.brakesRearLeft} active={isPartVisible(markerById.brakesRearLeft, filter)} />
              <BlueprintPartMarker x={120} y={496} part={markerById.brakesRearRight} active={isPartVisible(markerById.brakesRearRight, filter)} />
              <BlueprintPartMarker x={594} y={390} part={markerById.brakesFrontLeft} active={isPartVisible(markerById.brakesFrontLeft, filter)} />
              <BlueprintPartMarker x={594} y={496} part={markerById.brakesFrontRight} active={isPartVisible(markerById.brakesFrontRight, filter)} />

              <text x="710" y="330" fill="currentColor" stroke="none" className="text-[22px] font-black">Posterior</text>
              <path d="M704 552h253l13-38-8-82-35-57H735l-35 57-8 82 12 38Z" />
              <path d="M738 385h187l21 48H717l21-48Z" />
              <path d="M748 454h166v42H748z" />
              <path d="M724 514h212" />
              <path d="M694 458h-42m314 0h42" />
              <circle cx="731" cy="484" r="14" />
              <circle cx="929" cy="484" r="14" />
              <BlueprintPartMarker x={716} y={552} part={markerById.tireRearLeft} active={isPartVisible(markerById.tireRearLeft, filter)} />
              <BlueprintPartMarker x={944} y={552} part={markerById.tireRearRight} active={isPartVisible(markerById.tireRearRight, filter)} />
              <BlueprintPartMarker x={760} y={525} part={markerById.brakesRearLeft} active={isPartVisible(markerById.brakesRearLeft, filter)} />
              <BlueprintPartMarker x={900} y={525} part={markerById.brakesRearRight} active={isPartVisible(markerById.brakesRearRight, filter)} />
            </g>
          </svg>
        </div>

        <div className="grid content-start gap-3">
          {visibleParts.map((part) => (
            <BlueprintStat key={part.id} part={part} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlueprintWheel({
  cx,
  cy,
  part,
  active,
  small = false,
  compact = false,
}: {
  cx: number;
  cy: number;
  part?: BlueprintPart;
  active: boolean;
  small?: boolean;
  compact?: boolean;
}) {
  const radius = compact ? 34 : small ? 38 : 58;
  const color = part ? blueprintColor(part.percent) : "#22d3ee";

  if (!active) {
    return null;
  }

  return (
    <g strokeWidth={small || compact ? 2 : 3} opacity="0.98" stroke={color}>
      <circle cx={cx} cy={cy} r={radius} />
      <circle cx={cx} cy={cy} r={radius * 0.62} />
      <circle cx={cx} cy={cy} r={radius * 0.16} />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const x = cx + Math.cos(angle) * radius * 0.62;
        const y = cy + Math.sin(angle) * radius * 0.62;
        return <path key={index} d={`M${cx} ${cy} L${x.toFixed(1)} ${y.toFixed(1)}`} />;
      })}
      {part && !compact ? (
        <text x={cx} y={cy + radius + 34} fill={color} stroke="none" textAnchor="middle" className="text-[28px] font-black">
          {part.percent}%
        </text>
      ) : null}
    </g>
  );
}

function BlueprintPartMarker({ x, y, part, active }: { x: number; y: number; part?: BlueprintPart; active: boolean }) {
  if (!part || !active) {
    return null;
  }

  const color = blueprintColor(part.percent);

  return (
    <g opacity="1" stroke={color} fill="none">
      <circle cx={x} cy={y} r="22" strokeWidth="4" />
      <circle cx={x} cy={y} r="8" fill={color} stroke="none" />
      <text x={x} y={y - 34} fill={color} stroke="none" textAnchor="middle" className="text-[24px] font-black">
        {part.percent}%
      </text>
    </g>
  );
}

function BlueprintStat({ part }: { part: BlueprintPart }) {
  const tone = getHealthTone(part.percent);

  return (
    <article className="rounded-lg border border-cyan-300/20 bg-black/35 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase text-cyan-200">{part.label}</span>
        <strong className={tone.textColor}>{part.percent}%</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cyan-950/70">
        <div className={`h-full ${tone.barColor}`} style={{ width: `${part.percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-bold text-zinc-500">{part.description}</p>
    </article>
  );
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error ? error.message : null;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }

    const maybeError = "error_description" in error ? error.error_description : null;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }
  }

  return "No se pudo iniciar sesion. Revisa correo, contrasena y configuracion de Supabase.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function normalizePhoneInput(value: FormDataEntryValue | string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeVehicleKey(value: string | null | undefined) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function normalizeMileageUnit(value: FormDataEntryValue | null): "km" | "mi" {
  return value === "mi" ? "mi" : "km";
}

function getMileageInKm(
  kmValue: FormDataEntryValue | null,
  mileValue: FormDataEntryValue | null,
  preferredUnit: "km" | "mi",
) {
  const kilometers = parseOptionalNumber(kmValue);
  const miles = parseOptionalNumber(mileValue);

  if (preferredUnit === "mi") {
    return miles ? milesToKm(miles) : kilometers;
  }

  return kilometers ?? (miles ? milesToKm(miles) : null);
}

function milesToKm(value: number) {
  return Number((value * 1.609344).toFixed(1));
}

function kmToMiles(value: number) {
  return value / 1.609344;
}

function formatMileageBothUnits(value: number | null | undefined) {
  if (!value) {
    return "Pendiente";
  }

  const kilometers = value.toLocaleString("es-GT", { maximumFractionDigits: 1 });
  const miles = kmToMiles(value).toLocaleString("es-GT", { maximumFractionDigits: 1 });
  return `${kilometers} km / ${miles} mi`;
}

function formatEngineDisplacement(value: number) {
  return value >= 100 ? `${value.toLocaleString("es-GT")} cc` : `${value.toLocaleString("es-GT")} L`;
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
  const name = [vehicle.make, vehicle.model_line, vehicle.model_year].filter(Boolean).join(" ").trim();
  return `${name || "Vehiculo"} - ${vehicle.plate || vehicle.vin || "Sin placa"}`;
}

function vehicleIcon(vehicle: Vehicle) {
  const type = (vehicle.vehicle_type || "").toLowerCase();
  const seed = vehicle.id || vehicle.plate || vehicle.vin || "vehiculo";

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
  const name = [vehicle.make, vehicle.model_line, vehicle.model_year].filter(Boolean).join(" ").trim();
  return `${name || "Vehiculo"} - ${vehicle.plate || vehicle.vin || "Sin placa"}`;
}

function dealerRecordVehicleLabel(record: DealerVehicleRecord) {
  const name = [record.make, record.model_line, record.model_year].filter(Boolean).join(" ").trim();
  return `${name || "Vehiculo"} - ${record.plate || record.vin || "Sin placa"}`;
}

function isThisMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getDealerCustomerOptions(records: DealerVehicleRecord[]) {
  const customers = new Map<string, { key: string; name: string; phone: string | null; email: string | null }>();

  records.forEach((record) => {
    const key = record.customer_phone || record.customer_email || record.customer_name;

    if (!key || customers.has(key)) {
      return;
    }

    customers.set(key, {
      key,
      name: record.customer_name || record.customer_phone || record.customer_email || "",
      phone: record.customer_phone,
      email: record.customer_email,
    });
  });

  return Array.from(customers.values()).filter((customer) => customer.name);
}

function getDealerVehicleOptions(records: DealerVehicleRecord[]) {
  const vehicles = new Map<string, {
    key: string;
    plate: string | null;
    vin: string | null;
    make: string | null;
    modelLine: string | null;
  }>();

  records.forEach((record) => {
    const key = normalizeVehicleKey(record.vin) || normalizeVehicleKey(record.plate);

    if (!key || vehicles.has(key)) {
      return;
    }

    vehicles.set(key, {
      key,
      plate: record.plate,
      vin: record.vin,
      make: record.make,
      modelLine: record.model_line,
    });
  });

  return Array.from(vehicles.values());
}

function mapClaimedDealerRecordsToVehicles(records: DealerVehicleRecord[], existingVehicles: Vehicle[]): Vehicle[] {
  const existingKeys = new Set(
    existingVehicles.flatMap((vehicle) => getVehicleMatchKeys(vehicle)).filter(Boolean),
  );
  const vehicles = new Map<string, Vehicle>();

  records.forEach((record) => {
    const key = getDealerRecordVehicleKey(record);

    if (!key || existingKeys.has(key)) {
      return;
    }

    const current = vehicles.get(key);
    const currentMileage = Math.max(
      Number(current?.current_mileage ?? 0),
      Number(record.mileage ?? 0),
    ) || null;

    vehicles.set(key, {
      id: getDealerVirtualVehicleId(key),
      owner_name: record.customer_name || "Cliente Nyfrom",
      plate: record.plate,
      vin: record.vin,
      make: record.make,
      model_line: record.model_line,
      model_year: record.model_year,
      engine: record.engine,
      usage: null,
      vehicle_type: "Automovil",
      seats: null,
      color: null,
      cylinders: null,
      cc: null,
      current_mileage: currentMileage,
      current_mileage_unit: "km",
    });
  });

  return Array.from(vehicles.values());
}

function mapClaimedDealerRecordsToServices(records: DealerVehicleRecord[], vehicles: Vehicle[]): ServiceRecord[] {
  return records.flatMap((record) => {
    const matchingVehicle = findVehicleForDealerRecord(record, vehicles);

    if (!matchingVehicle) {
      return [];
    }

    return [{
      id: `dealer-${record.id}`,
      vehicle_id: matchingVehicle.id,
      service_type: record.service_type,
      service_date: record.service_date,
      mileage: record.mileage,
      recommended_interval_km: record.next_service_applies === false
        ? null
        : record.recommended_interval_km ?? serviceIntervals[record.service_type] ?? null,
      next_service_date: record.next_service_applies === false ? null : record.next_service_date,
      estimated_cost: record.estimated_cost,
      notes: [record.notes, "Registro importado de dealer Nyfrom"].filter(Boolean).join(" | "),
      vehicles: {
        plate: matchingVehicle.plate,
        make: matchingVehicle.make,
        model_line: matchingVehicle.model_line,
        model_year: matchingVehicle.model_year,
        vin: matchingVehicle.vin,
      },
    }];
  });
}

function findVehicleForDealerRecord(record: DealerVehicleRecord, vehicles: Vehicle[]) {
  const dealerVehicleId = getDealerVirtualVehicleId(getDealerRecordVehicleKey(record));
  const recordVin = normalizeVehicleKey(record.vin);
  const recordPlate = normalizeVehicleKey(record.plate);
  const recordMake = normalizeVehicleKey(record.make);
  const recordLine = normalizeVehicleKey(record.model_line);
  const recordYear = record.model_year ? String(record.model_year) : "";

  return vehicles.find((vehicle) => (
    vehicle.id === dealerVehicleId
    ||
    (recordVin && normalizeVehicleKey(vehicle.vin) === recordVin)
    || (
      recordPlate
      && normalizeVehicleKey(vehicle.plate) === recordPlate
      && (!recordMake || normalizeVehicleKey(vehicle.make) === recordMake)
      && (!recordLine || normalizeVehicleKey(vehicle.model_line) === recordLine)
      && (!recordYear || String(vehicle.model_year ?? "") === recordYear)
    )
  ));
}

function getDealerRecordVehicleKey(record: DealerVehicleRecord) {
  const vin = normalizeVehicleKey(record.vin);

  if (vin) {
    return vin;
  }

  const composite = [
    record.make,
    record.model_line,
    record.model_year,
    record.plate,
  ].map((value) => normalizeVehicleKey(String(value ?? ""))).filter(Boolean).join("-");

  return composite || `RECORD${record.id}`;
}

function getVehicleMatchKeys(vehicle: Vehicle) {
  const vin = normalizeVehicleKey(vehicle.vin);
  const composite = [
    vehicle.make,
    vehicle.model_line,
    vehicle.model_year,
    vehicle.plate,
  ].map((value) => normalizeVehicleKey(String(value ?? ""))).filter(Boolean).join("-");

  return [vin, composite || normalizeVehicleKey(vehicle.plate)].filter(Boolean);
}

function getDealerVirtualVehicleId(key: string) {
  return `dealer-vehicle-${key}`;
}

function isDealerVirtualVehicleId(vehicleId: string) {
  return vehicleId.startsWith("dealer-vehicle-");
}

function isDealerImportedService(service: ServiceRecord) {
  return service.id.startsWith("dealer-") || isDealerVirtualVehicleId(service.vehicle_id);
}

function getUpcomingServices(services: ServiceRecord[], vehicles: Vehicle[], dailyKm: number) {
  if (!dailyKm) {
    return [];
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const latestByVehicleAndType = new Map<string, ServiceRecord>();

  services
    .filter((service) => (getServiceInterval(service) || service.next_service_date) && service.mileage)
    .forEach((service) => {
      const key = `${service.vehicle_id}-${service.service_type}`;
      const current = latestByVehicleAndType.get(key);

      if (!current || Number(service.mileage ?? 0) > Number(current.mileage ?? 0)) {
        latestByVehicleAndType.set(key, service);
      }
    });

  return Array.from(latestByVehicleAndType.values())
    .map((service) => {
      const intervalKm = getServiceInterval(service);
      const currentMileage = vehicleById.get(service.vehicle_id)?.current_mileage ?? Number(service.mileage ?? 0);
      const nextMileage = Number(service.mileage ?? 0) + intervalKm;
      const remainingKm = Math.max(0, nextMileage - currentMileage);
      const days = Math.ceil(remainingKm / dailyKm);
      const date = service.next_service_date
        ? new Date(`${service.next_service_date}T00:00:00`)
        : remainingKm <= 0
          ? new Date()
          : new Date(`${service.service_date}T00:00:00`);

      if (!service.next_service_date) {
        date.setDate(date.getDate() + days);
      }

      return {
        id: service.id,
        vehicleId: service.vehicle_id,
        serviceType: service.service_type,
        vehicle: serviceVehicleLabel(service),
        intervalKm,
        estimatedCost: service.estimated_cost ?? 0,
        currentMileage,
        nextMileage,
        estimatedDate: date.toISOString().slice(0, 10),
      };
    })
    .sort((a, b) => a.estimatedDate.localeCompare(b.estimatedDate));
}

function getServiceInterval(service: ServiceRecord) {
  return service.recommended_interval_km ?? serviceIntervals[service.service_type] ?? 0;
}

function getServiceHealth(services: ServiceRecord[], vehicles: Vehicle[]) {
  const servicesWithMileage = services.filter((service) => service.mileage && getServiceInterval(service));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const latestByType = new Map<string, ServiceRecord>();

  servicesWithMileage.forEach((service) => {
    const current = latestByType.get(service.service_type);
    if (!current || Number(service.mileage ?? 0) > Number(current.mileage ?? 0)) {
      latestByType.set(service.service_type, service);
    }
  });

  return Array.from(latestByType.values())
    .map((service) => {
      const intervalKm = getServiceInterval(service);
      const currentMileage = vehicleById.get(service.vehicle_id)?.current_mileage ?? Number(service.mileage ?? 0);
      const usedKm = Math.max(0, currentMileage - Number(service.mileage ?? 0));
      const remainingKm = Math.max(0, intervalKm - usedKm);
      const percent = intervalKm ? Math.max(0, Math.min(100, Math.round((remainingKm / intervalKm) * 100))) : 0;
      const tone = getHealthTone(percent);

      return {
        serviceType: service.service_type,
        intervalKm,
        remainingKm,
        percent,
        ...tone,
      };
    })
    .sort((a, b) => a.percent - b.percent);
}

function getBlueprintParts(items: ReturnType<typeof getServiceHealth>, services: ServiceRecord[], vehicles: Vehicle[]): BlueprintPart[] {
  const motor = getHealthPercent(items, "Servicio de Motor");
  const tires = getHealthPercent(items, "Servicio de Llantas");
  const brakes = getHealthPercent(items, "Servicio de Frenos");
  const suspension = getHealthPercent(items, "Servicio de Suspension");

  return [
    {
      id: "motor",
      group: "motor",
      label: "Motor",
      percent: motor,
      description: "Vida estimada segun el ultimo servicio de motor.",
    },
    {
      id: "tireFrontLeft",
      group: "tires",
      label: "Llanta delantera izquierda",
      percent: getPositionPercent(services, vehicles, "Delantera izquierda", tires),
      description: "Basado en cambio de llantas por posicion.",
    },
    {
      id: "tireFrontRight",
      group: "tires",
      label: "Llanta delantera derecha",
      percent: getPositionPercent(services, vehicles, "Delantera derecha", tires),
      description: "Basado en cambio de llantas por posicion.",
    },
    {
      id: "tireRearLeft",
      group: "tires",
      label: "Llanta trasera izquierda",
      percent: getPositionPercent(services, vehicles, "Trasera izquierda", tires),
      description: "Basado en cambio de llantas por posicion.",
    },
    {
      id: "tireRearRight",
      group: "tires",
      label: "Llanta trasera derecha",
      percent: getPositionPercent(services, vehicles, "Trasera derecha", tires),
      description: "Basado en cambio de llantas por posicion.",
    },
    {
      id: "brakesFrontLeft",
      group: "brakes",
      label: "Freno delantero izquierdo",
      percent: brakes,
      description: "Por ahora usa el porcentaje general del servicio de frenos.",
    },
    {
      id: "brakesFrontRight",
      group: "brakes",
      label: "Freno delantero derecho",
      percent: brakes,
      description: "Por ahora usa el porcentaje general del servicio de frenos.",
    },
    {
      id: "brakesRearLeft",
      group: "brakes",
      label: "Freno trasero izquierdo",
      percent: brakes,
      description: "Por ahora usa el porcentaje general del servicio de frenos.",
    },
    {
      id: "brakesRearRight",
      group: "brakes",
      label: "Freno trasero derecho",
      percent: brakes,
      description: "Por ahora usa el porcentaje general del servicio de frenos.",
    },
    {
      id: "suspensionFrontLeft",
      group: "suspension",
      label: "Amortiguador delantero izquierdo",
      percent: suspension,
      description: "Por ahora usa el porcentaje general del servicio de suspension.",
    },
    {
      id: "suspensionFrontRight",
      group: "suspension",
      label: "Amortiguador delantero derecho",
      percent: suspension,
      description: "Por ahora usa el porcentaje general del servicio de suspension.",
    },
    {
      id: "suspensionRearLeft",
      group: "suspension",
      label: "Amortiguador trasero izquierdo",
      percent: suspension,
      description: "Por ahora usa el porcentaje general del servicio de suspension.",
    },
    {
      id: "suspensionRearRight",
      group: "suspension",
      label: "Amortiguador trasero derecho",
      percent: suspension,
      description: "Por ahora usa el porcentaje general del servicio de suspension.",
    },
  ];
}

function getHealthPercent(items: ReturnType<typeof getServiceHealth>, serviceType: string) {
  return items.find((item) => item.serviceType === serviceType)?.percent ?? 0;
}

function getPositionPercent(services: ServiceRecord[], vehicles: Vehicle[], position: string, fallbackPercent: number) {
  const tireServices = services.filter((service) => service.service_type === "Servicio de Llantas");
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const latestPositionService = tireServices
    .filter((service) => service.notes?.toLowerCase().includes(position.toLowerCase()))
    .sort((a, b) => Number(b.mileage ?? 0) - Number(a.mileage ?? 0))[0];

  if (!latestPositionService) {
    return fallbackPercent;
  }

  const intervalKm = getServiceInterval(latestPositionService);
  const currentMileage = vehicleById.get(latestPositionService.vehicle_id)?.current_mileage ?? Number(latestPositionService.mileage ?? 0);
  const usedKm = Math.max(0, currentMileage - Number(latestPositionService.mileage ?? 0));
  const remainingKm = Math.max(0, intervalKm - usedKm);

  return intervalKm ? Math.max(0, Math.min(100, Math.round((remainingKm / intervalKm) * 100))) : fallbackPercent;
}

function isPartVisible(part: BlueprintPart | undefined, filter: string) {
  if (!part) {
    return false;
  }

  if (filter === "all") {
    return part.group === "motor" || part.group === "tires";
  }

  return part.group === filter;
}

function blueprintColor(percent: number) {
  if (percent <= 35) {
    return "#fb7185";
  }

  if (percent <= 65) {
    return "#facc15";
  }

  return "#34d399";
}

function getHealthTone(percent: number) {
  if (percent <= 35) {
    return {
      barColor: "bg-red-500",
      textColor: "text-red-300",
      ring: "border-red-500 text-red-200",
    };
  }

  if (percent <= 65) {
    return {
      barColor: "bg-yellow-400",
      textColor: "text-yellow-200",
      ring: "border-yellow-400 text-yellow-100",
    };
  }

  return {
    barColor: "bg-emerald-500",
    textColor: "text-emerald-300",
    ring: "border-emerald-500 text-emerald-200",
  };
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
