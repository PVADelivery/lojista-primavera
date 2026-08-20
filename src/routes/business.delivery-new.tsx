import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "@/services/companies";
import { useCredits } from "@/services/credits";
import { brl } from "@/lib/format";

import { toast } from "sonner";
import { RegionZoneSelector } from "@/components/business/RegionZoneSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, MapPin, Banknote, Car, Motorbike, Info, Phone, Search, Navigation, Maximize2, MapPinned, X, Check, Home, Briefcase, Package } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type * as maplibregl from "maplibre-gl";
import { loadMapLibre, getMapLibre } from "@/lib/maplibre";
import { createPortal } from "react-dom";

export const Route = createFileRoute("/business/delivery-new")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      edit: (search.edit as string) || undefined,
    };
  },
  component: NewDeliveryPage,
});

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function NewDeliveryPage() {
  const { user } = useAuth();
  const { data: company } = useMyCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { edit: editId } = Route.useSearch();
  const [deliveryMode, setDeliveryMode] = useState<"rapida" | "normal">("rapida");
  const [batchCount, setBatchCount] = useState<number>(1);
  const [batchItems, setBatchItems] = useState<
    { customer_name: string; customer_phone: string; region_id: string; value: number }[]
  >([
    { customer_name: "", customer_phone: "", region_id: "none", value: 0 },
    { customer_name: "", customer_phone: "", region_id: "none", value: 0 },
    { customer_name: "", customer_phone: "", region_id: "none", value: 0 },
  ]);

  const handleBatchCountChange = (cnt: number) => {
    const newCount = Math.max(1, Math.min(30, cnt));
    setBatchCount(newCount);
    setBatchItems((prev) => {
      const next = [...prev];
      while (next.length < newCount) {
        next.push({ customer_name: "", customer_phone: "", region_id: "none", value: 0 });
      }
      return next.slice(0, newCount);
    });
  };

  // Form State
  const [f, setF] = useState({
    delivery_type: "NORMAL",
    customer_name: "",
    customer_phone: "",
    customer_cpf: "",
    address: "",
    customer_address_number: "",
    customer_neighborhood: "",
    customer_address_complement: "",
    payment_method: "cartao",
    is_paid: false,
    order_value: "",
    change_for: "",
    vehicle_type: "moto",
    region_id: "none",
    value: "", // Taxa definida pela região selecionada
    notes: "",
    address_label: "Casa",
  });

  // Coords state is defined below, but we need it here for useEffect. We can define our coords state here or do state updates inside useEffect later.
  // Let's define the query and effect here, but define coords state above.
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<[number, number] | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const { data: editingDelivery } = useQuery({
    queryKey: ["delivery", editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await supabase.from("deliveries").select("*").eq("id", editId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!editId,
  });

  useEffect(() => {
    if (editingDelivery) {
      setF({
        delivery_type: editingDelivery.delivery_type || "NORMAL",
        customer_name: editingDelivery.customer_name || "",
        customer_phone: editingDelivery.customer_phone || "",
        customer_cpf: editingDelivery.customer_cpf || "",
        address: editingDelivery.address ? editingDelivery.address.split(" - ")[0] : "",
        customer_address_number: editingDelivery.customer_address_number || "",
        customer_neighborhood: editingDelivery.customer_neighborhood || "",
        customer_address_complement: editingDelivery.customer_address_complement || "",
        payment_method: editingDelivery.payment_method === "pago" ? "dinheiro" : editingDelivery.payment_method || "dinheiro",
        is_paid: editingDelivery.payment_method === "pago",
        order_value: editingDelivery.order_value ? Number(editingDelivery.order_value).toFixed(2) : "",
        change_for: editingDelivery.change_for ? Number(editingDelivery.change_for).toFixed(2) : "",
        vehicle_type: editingDelivery.vehicle_type || "moto",
        region_id: editingDelivery.region_id || "none",
        value: editingDelivery.value ? String(editingDelivery.value) : "",
        notes: editingDelivery.notes || "",
        address_label: editingDelivery.address_label || "Casa",
      });


      if (editingDelivery.latitude && editingDelivery.longitude) {
        setDropoffCoords([editingDelivery.longitude, editingDelivery.latitude]);
      }
    }
  }, [editingDelivery]);
  // Autocomplete / Search State
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeBatchSearchIdx, setActiveBatchSearchIdx] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);


  // Map and routing State
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Fullscreen map states
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapContainerFull = useRef<HTMLDivElement>(null);
  const mapFull = useRef<maplibregl.Map | null>(null);
  const [dropoffText, setDropoffText] = useState("");
  const [dropoffNumber, setDropoffNumber] = useState("");
  const [dropoffSuggestions, setDropoffSuggestions] = useState<any[]>([]);
  const [searchingDropoff, setSearchingDropoff] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const PVA_BOUNDS = "-54.40,-15.65,-54.20,-15.45";

  // Regions are now loaded by the RegionPickerGrid component internally

  // Fetch or set company location
  useEffect(() => {
    if (company) {
      if (company.latitude && company.longitude) {
        setPickupCoords([company.longitude, company.latitude]);
      } else if (company.address) {
        const q = `${company.address}, Primavera do Leste, MT`;
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data[0]) {
              setPickupCoords([parseFloat(data[0].lon), parseFloat(data[0].lat)]);
            } else {
              setPickupCoords([-54.3075, -15.5606]);
            }
          })
          .catch(() => {
            setPickupCoords([-54.3075, -15.5606]);
          });
      } else {
        setPickupCoords([-54.3075, -15.5606]);
      }
    }
  }, [company]);

  // Taxa de entrega definida exclusivamente pela região selecionada no RegionZoneSelector.
  const { balance: creditBalance } = useCredits();
  const deliveryFee = Number(f.value || 0);
  const insufficientCredits = !editId && deliveryFee > 0 && creditBalance < deliveryFee;


  // Customer search autocomplete query consolidado (deliveries, orders e customers)
  useEffect(() => {
    if (customerQuery.trim().length < 1) {
      setCustomerSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const clean = customerQuery.trim();
      const phoneOrCpfClean = clean.replace(/\D/g, "");
      const combinedMap = new Map<string, any>();

      // 1. Busca na tabela deliveries (Histórico de entregas da loja)
      try {
        let delQuery = supabase
          .from("deliveries")
          .select("customer_id, customer_name, customer_phone, customer_cpf, address, region_id")
          .order("created_at", { ascending: false })
          .limit(20);

        if (company?.id) {
          delQuery = delQuery.eq("company_id", company.id);
        }

        if (phoneOrCpfClean.length >= 2) {
          delQuery = delQuery.or(`customer_name.ilike.%${clean}%,customer_phone.ilike.%${phoneOrCpfClean}%`);
        } else {
          delQuery = delQuery.ilike("customer_name", `%${clean}%`);
        }

        const { data: delData, error: delErr } = await delQuery;
        if (delErr) console.warn("delQuery error:", delErr);

        if (delData) {
          delData.forEach((d: any) => {
            const key = (d.customer_name || "").toLowerCase().trim() || d.customer_phone;
            if (key && !combinedMap.has(key)) {
              combinedMap.set(key, {
                id: d.customer_id || key,
                name: d.customer_name,
                phone: d.customer_phone,
                cpf: d.customer_cpf,
                region_id: d.region_id || "none",
                addresses: d.address ? [{
                  id: "del-addr",
                  street: d.address,
                  region_id: d.region_id || "none"
                }] : []
              });
            }
          });
        }
      } catch (e) {
        console.warn("Erro ao buscar deliveries em autocomplete:", e);
      }

      // 2. Busca na tabela orders (Pedidos Marketplace)
      try {
        let ordQuery = supabase
          .from("orders")
          .select("customer_name, customer_phone, delivery_address")
          .order("created_at", { ascending: false })
          .limit(20);

        if (company?.id) {
          ordQuery = ordQuery.eq("company_id", company.id);
        }

        if (phoneOrCpfClean.length >= 2) {
          ordQuery = ordQuery.or(`customer_name.ilike.%${clean}%,customer_phone.ilike.%${phoneOrCpfClean}%`);
        } else {
          ordQuery = ordQuery.ilike("customer_name", `%${clean}%`);
        }

        const { data: ordData, error: ordErr } = await ordQuery;
        if (ordErr) console.warn("ordQuery error:", ordErr);

        if (ordData) {
          ordData.forEach((o: any) => {
            const key = (o.customer_name || "").toLowerCase().trim() || o.customer_phone;
            if (key && !combinedMap.has(key)) {
              const streetStr = typeof o.delivery_address === "string" ? o.delivery_address : o.delivery_address?.street || "";
              combinedMap.set(key, {
                id: key,
                name: o.customer_name,
                phone: o.customer_phone,
                cpf: "",
                addresses: streetStr ? [{
                  id: "ord-addr",
                  street: streetStr,
                  number: o.delivery_address?.number || "",
                  neighborhood: o.delivery_address?.neighborhood || "",
                }] : []
              });
            }
          });
        }
      } catch (e) {
        console.warn("Erro ao buscar orders em autocomplete:", e);
      }

      // 3. Busca na tabela customers (Clientes Salvos)
      try {
        let custQuery = supabase
          .from("customers")
          .select("id, name, phone, cpf")
          .limit(20);

        if (phoneOrCpfClean.length >= 2) {
          custQuery = custQuery.or(`name.ilike.%${clean}%,phone.ilike.%${phoneOrCpfClean}%`);
        } else {
          custQuery = custQuery.ilike("name", `%${clean}%`);
        }

        const { data: custData, error: custErr } = await custQuery;
        if (custErr) console.warn("custQuery error:", custErr);

        if (custData) {
          custData.forEach((c: any) => {
            const key = (c.name || "").toLowerCase().trim() || c.phone;
            if (key) {
              const existing = combinedMap.get(key);
              if (existing) {
                if (c.cpf && !existing.cpf) existing.cpf = c.cpf;
                if (c.phone && !existing.phone) existing.phone = c.phone;
                existing.id = c.id;
              } else {
                combinedMap.set(key, { ...c, addresses: [] });
              }
            }
          });
        }
      } catch (e) {
        console.warn("Erro ao buscar customers em autocomplete:", e);
      }

      setCustomerSuggestions(Array.from(combinedMap.values()));
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [customerQuery, company?.id]);

  // Load MapLibre GL - Small Map (Disabled interaction, just shows the route/markers)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = pickupCoords || [-54.3075, -15.5606];

    let cancelled = false;
    const initSmall = async () => {
      const ml = await loadMapLibre();
      if (cancelled || !mapContainerRef.current || mapRef.current) return;
      mapRef.current = new ml.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [{ id: "osm-layer", type: "raster", source: "osm-tiles" }],
      },
      center: [initialCenter[0], initialCenter[1]],
      zoom: 12,
      attributionControl: false,
      interactive: false, // Make small map static
      });
    };
    initSmall();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pickupCoords]);

  // Load MapLibre GL - Fullscreen Modal
  useEffect(() => {
    if (!isMapFullscreen || !mapContainerFull.current || mapFull.current) return;

    const center = dropoffCoords || pickupCoords || [-54.3075, -15.5606];

    let cancelledFull = false;
    const initFull = async () => {
      const ml = await loadMapLibre();
      if (cancelledFull || !mapContainerFull.current || mapFull.current) return;
      mapFull.current = new ml.Map({
      container: mapContainerFull.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [{ id: "osm-layer", type: "raster", source: "osm-tiles" }],
      },
      center: [center[0], center[1]],
      zoom: 15,
      attributionControl: false,
      });
      mapFull.current.addControl(new ml.NavigationControl(), "bottom-right");
    };
    initFull();

    return () => {
      cancelledFull = true;
      mapFull.current?.remove();
      mapFull.current = null;
    };
  }, [isMapFullscreen]);

  // Algorithmic neighborhood geofencing
  const getCorrectBairro = (lon: number, lat: number, streetName: string, addr?: any): string => {
    if (addr) {
      const osmBairro = addr.suburb || addr.neighbourhood || addr.city_district || addr.residential;
      if (osmBairro && osmBairro.toLowerCase() !== "parque eldorado") {
        return osmBairro;
      }
    }
    const street = streetName.toLowerCase();
    if (street.includes("ari krief") || street.includes("ari kriff")) return "Jardim Progresso";
    if (street.includes("santo amaro")) {
      if (lon < -54.307) return "Primavera I";
      if (lon < -54.298) return "Jardim Riva";
      return "Centro";
    }
    if (street.includes("david riva") || street.includes("avenida primavera") || street.includes("campo grande")) {
      if (lon < -54.300) return "Jardim Riva";
      return "Centro";
    }
    if (street.includes("piracicaba") || street.includes("paranatinga") || street.includes("cuiaba") || street.includes("cuiabá") || street.includes("porto alegre")) {
      return "Centro";
    }
    if (street.includes("belo horizonte") || street.includes("curitiba") || street.includes("sao paulo") || street.includes("são paulo")) {
      return "Centro";
    }
    if (street.includes("pion. poncio") || street.includes("poncho verde")) return "Poncho Verde";
    if (street.includes("castelandia") || street.includes("castelândia")) return "Castelândia";
    if (street.includes("são joão") || street.includes("sao joao")) return "Centro";
    return "";
  };

  const formatSuggestionLabel = (item: any) => {
    const lon = parseFloat(item.lon);
    const lat = parseFloat(item.lat);
    const addr = item.address || {};
    const street = addr.road || addr.street || item.display_name.split(",")[0] || "";
    const bairro = getCorrectBairro(lon, lat, street, addr);
    const city = addr.city || addr.town || addr.municipality || "Primavera do Leste";
    return {
      main: bairro ? `${street}, ${bairro}` : street,
      sub: `${city} - MT`
    };
  };

  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
        { headers: { "User-Agent": "Primavera-Delivery/1.0" } }
      );
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const street = addr.road || addr.street || data.display_name.split(",")[0] || "";
        const bairro = getCorrectBairro(lng, lat, street, addr);
        const addressShort = bairro ? `${street}, ${bairro}` : street;

        setDropoffText(addressShort);
        const houseNo = addr.house_number || "";
        if (houseNo) setDropoffNumber(houseNo);

        setF((prev) => ({
          ...prev,
          address: street,
          customer_address_number: houseNo || prev.customer_address_number,
          customer_neighborhood: bairro || prev.customer_neighborhood,
          region_id: "none"
        }));
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  const searchAddress = (query: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setDropoffSuggestions([]);
      return;
    }
    setSearchingDropoff(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          query
        )}&viewbox=${PVA_BOUNDS}&bounded=1&limit=6`;
        const res = await fetch(url, { headers: { "User-Agent": "Primavera-Delivery/1.0" } });
        const data = await res.json();
        setDropoffSuggestions(data);
      } catch (err) {
        console.error("Address search error:", err);
      } finally {
        setSearchingDropoff(false);
      }
    }, 400);
  };

  const selectSuggestion = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const label = formatSuggestionLabel(item);
    const streetBairro = label.main;

    setDropoffCoords([lon, lat]);
    setDropoffText(streetBairro);
    setDropoffSuggestions([]);

    const addr = item.address || {};
    const street = addr.road || addr.street || item.display_name.split(",")[0] || "";
    const bairro = getCorrectBairro(lon, lat, street, addr);

    setF((prev) => ({
      ...prev,
      address: street,
      customer_neighborhood: bairro,
      region_id: "none"
    }));

    if (mapFull.current) {
      mapFull.current.flyTo({ center: [lon, lat], zoom: 16, duration: 1000 });
    }
  };

  const handleSelectLocationAtCenter = () => {
    const m = mapFull.current;
    if (!m) return;
    const center = m.getCenter();
    const coords: [number, number] = [center.lng, center.lat];
    setDropoffCoords(coords);
    fetchAddressFromCoords(center.lat, center.lng);
    setIsMapFullscreen(false);
  };

  // Update map markers and route when coordinates change
  useEffect(() => {
    const map = mapRef.current;
    const ml = getMapLibre();
    if (!map || !ml) return;

    // Handle pickup marker
    if (pickupCoords) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLngLat(pickupCoords);
      } else {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white border-2 border-white shadow-lg";
        el.innerHTML = "🏪";
        pickupMarkerRef.current = new ml.Marker({ element: el })
          .setLngLat(pickupCoords)
          .addTo(map);
      }
    }

    // Handle dropoff marker
    if (dropoffCoords) {
      if (dropoffMarkerRef.current) {
        dropoffMarkerRef.current.setLngLat(dropoffCoords);
      } else {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 text-white border-2 border-white shadow-lg";
        el.innerHTML = "📍";
        dropoffMarkerRef.current = new ml.Marker({ element: el })
          .setLngLat(dropoffCoords)
          .addTo(map);
      }

      // Fly to dropoff
      map.flyTo({ center: dropoffCoords, zoom: 14, duration: 1500 });
    }

    // Route calculation
    if (pickupCoords && dropoffCoords) {
      const getRoute = async () => {
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickupCoords[0]},${pickupCoords[1]};${dropoffCoords[0]},${dropoffCoords[1]}?overview=full&geometries=geojson`
          );
          const data = await res.json();
          if (data && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const dist = route.distance / 1000;
            setRouteDistance(dist);

            const routeGeoJSON = route.geometry;

            if (map.getSource("route")) {
              (map.getSource("route") as any).setData(routeGeoJSON);
            } else {
              map.addSource("route", { type: "geojson", data: routeGeoJSON });
              map.addLayer({
                id: "route",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#8b5cf6", "line-width": 5, "line-opacity": 0.75 },
              });
            }
            return;
          }
        } catch (err) {
          console.error("OSRM error:", err);
        }

        // Straight line fallback
        const dist = calculateHaversineDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0]);
        setRouteDistance(dist);

        const fallbackGeoJSON = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [pickupCoords, dropoffCoords],
          },
        };

        if (map.getSource("route")) {
          (map.getSource("route") as any).setData(fallbackGeoJSON);
        } else {
          map.addSource("route", { type: "geojson", data: fallbackGeoJSON });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#e11d48", "line-width": 4, "line-dasharray": [2, 2] },
          });
        }
      };

      getRoute();
    }
  }, [pickupCoords, dropoffCoords]);

  // Update shipping value dynamically based on distance and vehicle type
  useEffect(() => {
    if (routeDistance !== null) {
      let baseFee = 5.99;
      let rate = 2.0;
      if (f.vehicle_type === "carro") {
        baseFee = 9.99;
        rate = 3.0;
      } else if (f.vehicle_type === "carro_aberto") {
        baseFee = 30.0;
        rate = 5.0;
      }
      const calculatedVal = baseFee + routeDistance * rate;
      setF((prev) => ({ ...prev, value: calculatedVal.toFixed(2) }));
    }
  }, [routeDistance, f.vehicle_type]);

  const handleGeocodeSearch = async () => {
    if (!f.address) return;
    setIsGeocoding(true);
    const queryStr = `${f.address}, ${f.customer_address_number} - ${f.customer_neighborhood}, MT, Brazil`;
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`);
      const data = await resp.json();
      if (data && data[0]) {
        setDropoffCoords([parseFloat(data[0].lon), parseFloat(data[0].lat)]);
        toast.success("Endereço localizado no mapa!");
      } else {
        // Try without neighborhood
        const queryStr2 = `${f.address}, ${f.customer_address_number}, MT, Brazil`;
        const resp2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr2)}&limit=1`);
        const data2 = await resp2.json();
        if (data2 && data2[0]) {
          setDropoffCoords([parseFloat(data2[0].lon), parseFloat(data2[0].lat)]);
          toast.success("Endereço localizado no mapa!");
        } else {
          toast.error("Não foi possível localizar o endereço no mapa. Ajuste os campos ou clique no mapa manualmente.");
        }
      }
    } catch (err) {
      toast.error("Erro ao buscar coordenadas do endereço.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const selectCustomer = (cust: any, targetAddress?: any) => {
    setSelectedCustomerId(cust.id);
    setF((prev) => ({
      ...prev,
      customer_name: cust.name,
      customer_phone: cust.phone || "",
      customer_cpf: cust.cpf || "",
    }));

    const addr = targetAddress || (cust.addresses && cust.addresses.length > 0 ? cust.addresses[0] : null);
    if (addr) {
      setF((prev) => ({
        ...prev,
        address: addr.street,
        customer_address_number: addr.number || "",
        customer_neighborhood: addr.neighborhood || "",
        customer_address_complement: addr.complement || "",
        region_id: addr.region_id || "none",
        address_label: addr.label || "Casa",
      }));

      if (addr.latitude && addr.longitude) {
        setDropoffCoords([addr.longitude, addr.latitude]);
      }
    }
    setShowSuggestions(false);
  };

  const selectBatchCustomer = (idx: number, cust: any, targetAddress?: any) => {
    const addr = targetAddress || (cust.addresses && cust.addresses.length > 0 ? cust.addresses[0] : null);
    const targetRegionId = addr?.region_id || cust.region_id || "none";

    setBatchItems((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        customer_name: cust.name || copy[idx].customer_name,
        customer_phone: cust.phone || copy[idx].customer_phone,
        region_id: targetRegionId !== "none" ? targetRegionId : copy[idx].region_id,
      };
      return copy;
    });

    setShowSuggestions(false);
    setActiveBatchSearchIdx(null);
    toast.success(`Cliente ${cust.name} preenchido na Entrega #${idx + 1}!`);
  };

  const handleRegionSelect = (fee: number, regionId: string, regionName: string) => {
    setF(prev => ({
      ...prev,
      region_id: regionId,
      value: fee.toFixed(2),
      customer_neighborhood: regionName || prev.customer_neighborhood,
    }));
  };

  const handleMoneyChange = (field: "value" | "order_value" | "change_for", val: string) => {
    const numeric = val.replace(/\D/g, "");
    if (!numeric) {
      setF({ ...f, [field]: "" });
      return;
    }
    const formatted = (Number(numeric) / 100).toFixed(2);
    setF({ ...f, [field]: formatted });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (batchCount > 1 && deliveryMode === "rapida") {
      const activeItems = batchItems.slice(0, batchCount);
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        if (!item.customer_name.trim()) {
          toast.error(`Informe o Nome do Cliente na Entrega #${i + 1}`);
          return;
        }
        if (!item.region_id || item.region_id === "none") {
          toast.error(`Selecione a Região de Destino na Entrega #${i + 1}`);
          return;
        }
      }

      const totalBatchFee = activeItems.reduce((acc, item) => acc + (item.value || 0), 0);
      if (!editId && creditBalance < totalBatchFee) {
        toast.error(`Saldo de créditos insuficiente. Saldo: ${brl(creditBalance)} · Necessário: ${brl(totalBatchFee)}.`);
        return;
      }

      setBusy(true);
      try {
        const payload = activeItems.map((item) => ({
          customer_name: item.customer_name.trim(),
          customer_phone: item.customer_phone.trim(),
          address: "Entrega Rápida",
          region_id: item.region_id,
          value: item.value,
          vehicle_type: "moto",
          payment_method: "dinheiro",
          is_paid: true,
          notes: "Entrega Rápida em Lote",
        }));

        const { data: res, error: rpcErr } = await supabase.rpc("batch_create_delivery_requests", {
          p_company_id: company.id,
          p_deliveries: payload,
        });

        if (rpcErr) throw rpcErr;
        if (!res?.success) throw new Error(res?.error || "Erro ao criar entregas em lote.");

        toast.success(`🚀 ${res.count} entregas criadas em lote com sucesso!`);
        qc.invalidateQueries({ queryKey: ["deliveries"] });
        qc.invalidateQueries({ queryKey: ["credits"] });
        qc.invalidateQueries({ queryKey: ["credit-transactions"] });
        navigate({ to: "/business" });
      } catch (err: any) {
        toast.error(err.message || "Erro ao criar entregas em lote.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!f.value || Number(f.value) <= 0) {
      toast.error("Selecione uma região de entrega para calcular a taxa.", { duration: 5000 });
      return;
    }

    if (deliveryMode === "normal" && !f.address.trim()) {
      toast.error("O endereço de entrega é obrigatório no modo normal.", { duration: 5000 });
      return;
    }

    const fullAddress = deliveryMode === "rapida" 
      ? `A combinar (Entrega Rápida) - Região: ${f.customer_neighborhood}`
      : `${f.address}, ${f.customer_address_number} - ${f.customer_neighborhood} ${f.customer_address_complement ? `(${f.customer_address_complement})` : ""}`;
    const shortId = "#" + Math.random().toString(36).substring(2, 6).toUpperCase();

    setBusy(true);

    try {
      // 1. Auto-save / Auto-update Customer in the database
      const isUuid = (val: string | null) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      let custId = isUuid(selectedCustomerId) ? selectedCustomerId : null;
      const phoneClean = f.customer_phone.replace(/\D/g, "");

      if (f.customer_name.trim()) {
        let existingCust: { id: string } | null = null;
        if (phoneClean) {
          const { data } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", phoneClean)
            .maybeSingle();
          existingCust = data;
        }
        
        if (!existingCust) {
          const { data } = await supabase
            .from("customers")
            .select("id")
            .ilike("name", f.customer_name.trim())
            .maybeSingle();
          existingCust = data;
        }

        const custPayload: any = {
          name: f.customer_name.trim(),
          phone: phoneClean || null,
          cpf: f.customer_cpf.replace(/\D/g, "") || null,
        };

        if (existingCust) {
          const { data: updatedCust, error: uErr } = await supabase
            .from("customers")
            .update(custPayload)
            .eq("id", existingCust.id)
            .select("id")
            .maybeSingle();
          if (uErr) console.error("[Update Customer Error]", uErr);
          if (updatedCust) custId = updatedCust.id;
        } else {
          const { data: insertedCust, error: iErr } = await supabase
            .from("customers")
            .insert([custPayload])
            .select("id")
            .maybeSingle();
          if (iErr) console.error("[Insert Customer Error]", iErr);
          if (insertedCust) custId = insertedCust.id;
        }
      }

      // 2. Save Address if customer exists and in normal mode
      if (custId && f.address.trim() && deliveryMode === "normal") {
        const { data: existingAddress } = await supabase
          .from("addresses")
          .select("id")
          .eq("customer_id", custId)
          .eq("street", f.address.trim())
          .eq("number", f.customer_address_number.trim())
          .maybeSingle();

        if (!existingAddress) {
          await supabase.from("addresses").insert([
            {
              customer_id: custId,
              street: f.address.trim(),
              number: f.customer_address_number.trim(),
              complement: f.customer_address_complement.trim() || null,
              neighborhood: f.customer_neighborhood.trim() || null,
              latitude: dropoffCoords ? dropoffCoords[1] : null,
              longitude: dropoffCoords ? dropoffCoords[0] : null,
              region_id: f.region_id === "none" ? null : f.region_id,
              label: f.address_label || "Casa",
            },
          ]);
        }
      }

      // 3. Write Manual Delivery (either update or insert)
      let deliveryWrite;
      if (editId) {
        deliveryWrite = await supabase
          .from("deliveries")
          .update({
            delivery_type: f.delivery_type || "NORMAL",
            company_id: company.id,
            customer_id: custId || null,
            customer_name: f.customer_name,
            customer_phone: f.customer_phone,
            customer_cpf: f.customer_cpf.replace(/\D/g, "") || null,
            address: fullAddress,
            customer_address_number: deliveryMode === "rapida" ? "S/N" : f.customer_address_number,
            customer_neighborhood: f.customer_neighborhood,
            customer_address_complement: f.customer_address_complement,
            payment_method: f.is_paid ? "pago" : f.payment_method,
            order_value: f.is_paid ? 0 : Number(f.order_value || 0),
            change_for: f.is_paid ? 0 : Number(f.change_for || 0),
            vehicle_type: f.vehicle_type,
            region_id: f.region_id === "none" ? null : f.region_id,
            value: Number(f.value || 0),
            notes: f.notes,
          })
          .eq("id", editId)
          .select("*")
          .single();
      } else {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("create_delivery_with_credits", {
          p_payload: {
            delivery_type: f.delivery_type || "NORMAL",
            company_name: company.name || "Loja Parceira",
            pickup_address: company.address || null,
            company_id: company.id,
            customer_id: custId || null,
            short_id: shortId,
            customer_name: f.customer_name,
            customer_phone: f.customer_phone,
            customer_cpf: f.customer_cpf.replace(/\D/g, "") || null,
            address: fullAddress,
            customer_address_number: deliveryMode === "rapida" ? "S/N" : f.customer_address_number,
            customer_neighborhood: f.customer_neighborhood,
            customer_address_complement: f.customer_address_complement,
            payment_method: f.is_paid ? "pago" : f.payment_method,
            order_value: f.is_paid ? 0 : Number(f.order_value || 0),
            change_for: f.is_paid ? 0 : Number(f.change_for || 0),
            vehicle_type: f.vehicle_type,
            region_id: f.region_id === "none" ? null : f.region_id,
            value: Number(f.value || 0),
            notes: f.notes,
            latitude: dropoffCoords ? dropoffCoords[1] : null,
            longitude: dropoffCoords ? dropoffCoords[0] : null,
            dropoff_latitude: dropoffCoords ? dropoffCoords[1] : null,
            dropoff_longitude: dropoffCoords ? dropoffCoords[0] : null,
            pickup_latitude: pickupCoords ? pickupCoords[1] : null,
            pickup_longitude: pickupCoords ? pickupCoords[0] : null,
            status: "pending",
          },
        });

        if (rpcErr) throw rpcErr;

        const res: any = rpcRes;
        if (!res?.success) {
          if (res?.error === "INSUFFICIENT_CREDITS") {
            toast.error(
              `Saldo de créditos insuficiente. Saldo: ${brl(Number(res.balance || 0))} · Necessário: ${brl(Number(res.required || 0))}. Solicite uma recarga em Financeiro > Créditos.`,
              { duration: 10000 }
            );
            setBusy(false);
            return;
          }
          if (res?.error === "FORBIDDEN") {
            toast.error("Você não tem permissão para criar entregas para esta empresa.", { duration: 8000 });
            setBusy(false);
            return;
          }
          throw new Error(res?.error || "Erro ao criar entrega.");
        }

        qc.invalidateQueries({ queryKey: ["credits"] });
        qc.invalidateQueries({ queryKey: ["credit-transactions"] });
        deliveryWrite = { data: { id: res.delivery_id }, error: null } as any;
      }

      if (deliveryWrite.error) {
        throw deliveryWrite.error;
      }


      toast.success(editId ? "Corrida atualizada com sucesso!" : "Corrida solicitada com sucesso!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      navigate({ to: "/business" });
    } catch (err: any) {
      if (err.code === "42501" || /row-level security/i.test(err.message)) {
        toast.error("Você não tem permissão para criar entregas para esta empresa.", { duration: 8000 });
      } else {
        toast.error(err.message || "Erro ao salvar entrega.", { duration: 8000 });
      }
    } finally {
      setBusy(false);
    }
  };

  const [batchModalOpen, setBatchModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: "/business" })}
              className="rounded-xl h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Sistema de Despacho</p>
              <h1 className="text-xl font-black tracking-tight">{editId ? "Editar Solicitação de Entrega" : "Nova Solicitação de Entrega"}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="bg-secondary/40 p-1 rounded-2xl flex gap-1 w-full shadow-sm border border-border/40">
            <button
              type="button"
              onClick={() => setDeliveryMode("rapida")}
              className={`flex-1 px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center leading-[1.1] gap-0.5 ${
                deliveryMode === "rapida" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <span>Entregas</span>
              <span>Rápidas</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMode("normal")}
              className={`flex-1 px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center leading-[1.1] gap-0.5 ${
                deliveryMode === "normal" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <span>Entrega</span>
              <span>Normal</span>
            </button>
          </div>
        </div>

        {/* CONTADOR DE ENTREGAS (Somente no modo Rápida e criação) */}
        {!editId && deliveryMode === "rapida" && (
          <div className="bg-card border-2 border-primary/20 p-5 rounded-[2rem] shadow-sm mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-black text-base">Quantidade de Entregas</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina 1 para entrega individual ou escolha mais entregas para cadastrar em lote diretamente nesta tela.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-secondary/60 p-1.5 rounded-2xl border border-border/40 self-start sm:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleBatchCountChange(batchCount - 1)}
                  disabled={batchCount <= 1}
                  className="h-10 w-10 rounded-xl font-black text-lg"
                >
                  -
                </Button>
                <div className="w-24 text-center font-black text-base text-primary">
                  {batchCount} {batchCount === 1 ? "entrega" : "entregas"}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleBatchCountChange(batchCount + 1)}
                  disabled={batchCount >= 30}
                  className="h-10 w-10 rounded-xl font-black text-lg"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/20 overflow-x-auto">
              <span className="text-xs font-bold text-muted-foreground mr-1 shrink-0">Atalhos rápidos:</span>
              {[1, 3, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleBatchCountChange(num)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    batchCount === num
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {num} {num === 1 ? "Entrega" : "Entregas"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FORMS: LOTE VS INDIVIDUAL */}
        {!editId && deliveryMode === "rapida" && batchCount > 1 ? (
          <form onSubmit={submit} className="space-y-6">
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-primary tracking-wider">Entregas Rápidas em Lote ({batchCount} entregas)</p>
                <p className="text-xs text-muted-foreground">Informe Nome, Telefone e a Região de cada entrega abaixo.</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-muted-foreground">Valor Total do Lote:</span>
                <div className="text-lg font-black text-primary">
                  {brl(batchItems.slice(0, batchCount).reduce((acc, item) => acc + (item.value || 0), 0))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {batchItems.slice(0, batchCount).map((item, idx) => (
                <div key={idx} className="bg-card border border-border/60 p-5 rounded-2xl space-y-4 shadow-sm relative">
                  <div className="flex items-center justify-between pb-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm">Entrega #{idx + 1}</span>
                    </div>
                    {item.value > 0 && (
                      <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        Taxa: {brl(item.value)}
                      </span>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-bold">Nome do cliente *</Label>
                      <Input
                        value={item.customer_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchItems((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], customer_name: val };
                            return copy;
                          });
                          setCustomerQuery(val);
                          setActiveBatchSearchIdx(idx);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => {
                          if (item.customer_name) setCustomerQuery(item.customer_name);
                          setActiveBatchSearchIdx(idx);
                          setShowSuggestions(true);
                        }}
                        required
                        className="rounded-xl h-11 bg-secondary/30"
                        placeholder="Ex: João Silva"
                      />

                      {/* Dropdown de Autocomplete para Entregas em Lote */}
                      {showSuggestions && activeBatchSearchIdx === idx && customerSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border-2 border-primary/30 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-border/20">
                          {customerSuggestions.map((cust) => (
                            <div key={cust.id} className="p-2 space-y-1 hover:bg-primary/5 transition-colors">
                              <button
                                type="button"
                                onClick={() => selectBatchCustomer(idx, cust, cust.addresses?.[0])}
                                className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors text-sm flex flex-col group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-foreground group-hover:text-primary transition-colors">{cust.name}</span>
                                  <span className="text-xs font-semibold text-muted-foreground">{cust.phone || "Sem telefone"}</span>
                                </div>
                                {cust.cpf && <span className="text-[10px] text-muted-foreground font-mono">CPF: {cust.cpf}</span>}
                              </button>
                              {cust.addresses && cust.addresses.length > 0 && (
                                <div className="pl-3 space-y-1">
                                  {cust.addresses.map((addr: any) => (
                                    <button
                                      key={addr.id}
                                      type="button"
                                      onClick={() => selectBatchCustomer(idx, cust, addr)}
                                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-primary/20 text-xs text-muted-foreground flex items-center gap-1.5 truncate"
                                    >
                                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                                      <span className="font-semibold text-foreground/80">{addr.label || 'Endereço'}:</span>
                                      <span className="truncate">{addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.neighborhood ? ` - ${addr.neighborhood}` : ''}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">WhatsApp / Telefone</Label>
                      <Input
                        value={item.customer_phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchItems((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], customer_phone: val };
                            return copy;
                          });
                          setCustomerQuery(val);
                          setActiveBatchSearchIdx(idx);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => {
                          if (item.customer_phone) setCustomerQuery(item.customer_phone);
                          setActiveBatchSearchIdx(idx);
                          setShowSuggestions(true);
                        }}
                        className="rounded-xl h-11 bg-secondary/30"
                        placeholder="(66) 99999-9999"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Região de Destino *</Label>
                    <RegionZoneSelector
                      companyId={company?.id}
                      selectedRegionId={item.region_id}
                      onSelectZone={(zoneId, val) => {
                        setBatchItems((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], region_id: zoneId, value: val };
                          return copy;
                        });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border/40 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Saldo disponível em créditos:</span>
                <span className="font-bold text-foreground">{brl(creditBalance)}</span>
              </div>
              <div className="flex justify-between items-center text-base font-bold">
                <span>Será debitado do seu saldo:</span>
                <span className="text-primary text-lg">
                  {brl(batchItems.slice(0, batchCount).reduce((acc, item) => acc + (item.value || 0), 0))}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy || (creditBalance < batchItems.slice(0, batchCount).reduce((acc, item) => acc + (item.value || 0), 0))}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Package className="h-5 w-5" />
                  <span>
                    Criar {batchCount} Solicitações de Entrega ({brl(batchItems.slice(0, batchCount).reduce((acc, item) => acc + (item.value || 0), 0))})
                  </span>
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-8 bg-card border border-border/40 p-6 sm:p-8 rounded-[2rem] shadow-sm">
          {/* Seção: Tipo de Solicitação */}
          <div className="space-y-3 bg-secondary/20 border border-border/40 p-4 sm:p-5 rounded-2xl">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Tipo de Solicitação
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setF((prev) => ({ ...prev, delivery_type: "NORMAL" }))}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all border ${
                  f.delivery_type !== "BUSCA_CONDICIONAL"
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                <span>📦 Entrega Normal</span>
              </button>
              <button
                type="button"
                onClick={() => setF((prev) => ({ ...prev, delivery_type: "BUSCA_CONDICIONAL" }))}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all border ${
                  f.delivery_type === "BUSCA_CONDICIONAL"
                    ? "bg-purple-600 text-white border-purple-600 shadow-md"
                    : "bg-background text-muted-foreground border-border hover:border-purple-500/40"
                }`}
              >
                <span>👗 Busca de Condicional</span>
              </button>
            </div>
            {f.delivery_type === "BUSCA_CONDICIONAL" ? (
              <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-2 bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                <p className="font-bold flex items-center gap-1.5 text-sm mb-1 text-purple-700 dark:text-purple-300">
                  <span>👗 Modalidade: Busca de Condicional</span>
                </p>
                <p>
                  O entregador irá <strong>coletar as roupas no Cliente</strong> e <strong>entregar na sua Loja</strong>.
                </p>
                <p className="mt-1 text-[11px] opacity-80">
                  📍 <strong>Origem:</strong> {f.customer_name || "Cliente"} → 📍 <strong>Destino:</strong> {company?.name || "Sua Loja"}
                </p>
              </div>
            ) : (
              <div className="text-xs font-medium text-muted-foreground mt-2 bg-muted/40 p-2.5 rounded-xl border border-border/40">
                📍 <strong>Origem:</strong> {company?.name || "Sua Loja"} → 📍 <strong>Destino:</strong> {f.customer_name || "Cliente"}
              </div>
            )}
          </div>

          {/* Seção: Cliente */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">1</span>
              Dados do Cliente
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 relative">
              <div className="space-y-1.5 relative">
                <Label>Nome do cliente</Label>
                <div className="relative">
                  <Input
                    value={f.customer_name}
                    onChange={(e) => {
                      setF({ ...f, customer_name: e.target.value });
                      setCustomerQuery(e.target.value);
                      setShowSuggestions(true);
                      if (!e.target.value) {
                        setSelectedCustomerId(null);
                      }
                    }}
                    onFocus={() => {
                      if (f.customer_name) setCustomerQuery(f.customer_name);
                      setShowSuggestions(true);
                    }}
                    required
                    className="rounded-xl h-11 bg-secondary/30"
                    placeholder="Ex: João da Silva"
                  />
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-popover border border-border rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-border/20">
                      {customerSuggestions.map((cust) => (
                        <div key={cust.id} className="p-2 space-y-1 hover:bg-primary/5 transition-colors">
                          <button
                            type="button"
                            onClick={() => {
                              selectCustomer(cust, cust.addresses?.[0]);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors text-sm flex flex-col group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors">{cust.name}</span>
                              <span className="text-xs font-semibold text-muted-foreground">{cust.phone || "Sem telefone"}</span>
                            </div>
                            {cust.cpf && <span className="text-[10px] text-muted-foreground font-mono">CPF: {cust.cpf}</span>}
                          </button>
                          {cust.addresses && cust.addresses.length > 0 && (
                            <div className="pl-3 space-y-1">
                              {cust.addresses.map((addr: any) => (
                                <button
                                  key={addr.id}
                                  type="button"
                                  onClick={() => {
                                    selectCustomer(cust, addr);
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full text-left px-2 py-1 rounded-lg hover:bg-primary/20 text-xs text-muted-foreground flex items-center gap-1.5 truncate"
                                >
                                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                                  <span className="font-semibold text-foreground/80">{addr.label || 'Endereço'}:</span>
                                  <span className="truncate">{addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.neighborhood ? ` - ${addr.neighborhood}` : ''}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={f.customer_phone}
                    onChange={(e) => {
                      setF({ ...f, customer_phone: e.target.value });
                      setCustomerQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (f.customer_phone) setCustomerQuery(f.customer_phone);
                      setShowSuggestions(true);
                    }}
                    className="rounded-xl h-11 pl-9 bg-secondary/30"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
            {deliveryMode === "normal" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CPF do Cliente (Opcional)</Label>
                  <Input
                    value={f.customer_cpf}
                    onChange={(e) => {
                      setF({ ...f, customer_cpf: e.target.value });
                      setCustomerQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (f.customer_cpf) setCustomerQuery(f.customer_cpf);
                      setShowSuggestions(true);
                    }}
                    className="rounded-xl h-11 bg-secondary/30"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Seção: Endereço */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">2</span>
              {deliveryMode === "rapida" ? "Região de Destino" : "Endereço de Destino"}
            </h3>
            <div className="space-y-4 p-5 rounded-[1.5rem] bg-secondary/20 border border-border/40">
              
              {deliveryMode === "normal" && (
                <>
                  <div className="grid sm:grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-1.5">
                      <Label>Rua / Avenida</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={f.address}
                          onChange={(e) => setF({ ...f, address: e.target.value })}
                          required={deliveryMode === "normal"}
                          className="rounded-xl h-11 pl-9 bg-background"
                          placeholder="Ex: Av. Brasil"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Número</Label>
                      <Input
                        value={f.customer_address_number}
                        onChange={(e) => setF({ ...f, customer_address_number: e.target.value })}
                        required={deliveryMode === "normal"}
                        className="rounded-xl h-11 bg-background"
                        placeholder="Ex: 123"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Complemento (Opcional)</Label>
                      <Input
                        value={f.customer_address_complement}
                        onChange={(e) => setF({ ...f, customer_address_complement: e.target.value })}
                        className="rounded-xl h-11 bg-background"
                        placeholder="Apto, Bloco, Casa..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de Endereço</Label>
                      <div className="flex gap-2">
                        {[
                          { id: "Casa", label: "Casa", icon: Home },
                          { id: "Trabalho", label: "Trabalho", icon: Briefcase },
                          { id: "Outro", label: "Outro", icon: MapPin },
                        ].map((item) => {
                          const active = f.address_label === item.id;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setF({ ...f, address_label: item.id })}
                              className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-xs font-bold transition-all ${
                                active
                                  ? "border-primary bg-primary/10 text-primary animate-scaleIn"
                                  : "border-input bg-background text-muted-foreground hover:bg-muted/50"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="space-y-1.5">
                    <Label>Observações para o Entregador (Opcional)</Label>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <textarea
                        value={f.notes}
                        onChange={(e) => setF({ ...f, notes: e.target.value })}
                        className="w-full rounded-xl border border-input bg-secondary/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] pl-9 resize-none"
                        placeholder="Instruções de cuidado, como chegar, etc."
                      />
                    </div>
                  </div>

                  {/* Localização / mapa oculto */}
                  <div className="space-y-2 pt-2">
                    <div ref={mapContainerRef} className="hidden" />
                    {routeDistance !== null && (
                      <p className="text-xs font-semibold text-primary mt-1">
                        Distância calculada: {routeDistance.toFixed(2)} KM
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Regiões / Tabela de preços */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Região de Entrega <span className="text-destructive">*</span></Label>
                <RegionZoneSelector
                  onRegionSelect={handleRegionSelect}
                  onSelectZone={(zoneId, price) => handleRegionSelect(price, zoneId, "")}
                  companyId={company?.id}
                  initialSelectedId={f.region_id}
                />
              </div>

            </div>
          </section>

          {/* Seção: Acerto Financeiro */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">3</span>
              Acerto com Cliente (Cobrança)
            </h3>
            <div className="space-y-4 p-5 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-emerald-500/20">
                <div className="space-y-0.5">
                  <Label className="text-base text-emerald-800 dark:text-emerald-400">Pedido já foi pago?</Label>
                  <p className="text-xs text-muted-foreground">O entregador não precisará cobrar nada do cliente.</p>
                </div>
                <Switch checked={f.is_paid} onCheckedChange={(c) => setF({ ...f, is_paid: c })} />
              </div>

              {!f.is_paid && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-emerald-700 dark:text-emerald-400">Forma de Pagamento</Label>
                      <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
                        <SelectTrigger className="rounded-xl h-11 bg-background border-emerald-500/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao">Cartão (Maquininha)</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="convenio">Convênio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-emerald-700 dark:text-emerald-400 font-bold">Valor a Cobrar do Cliente</Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600 dark:text-emerald-400">
                          R$
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={f.order_value}
                          onChange={(e) => handleMoneyChange("order_value", e.target.value)}
                          required
                          className="rounded-xl h-11 pl-10 bg-background border-emerald-500/40 font-black text-base text-emerald-900 dark:text-emerald-200"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>

                  {f.payment_method === "dinheiro" && (
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-emerald-700 dark:text-emerald-400 font-bold">
                        Troco para (R$) - Deixe 0,00 se não precisar
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600 dark:text-emerald-400">
                          R$
                        </div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={f.change_for}
                          onChange={(e) => handleMoneyChange("change_for", e.target.value)}
                          className="rounded-xl h-11 pl-10 bg-background border-emerald-500/40 font-bold text-base"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4">
            {!editId && (
              <div
                className={`mb-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                  insufficientCredits ? "border-destructive/50 bg-destructive/10" : "border-border/60 bg-card"
                }`}
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Saldo de créditos
                  </p>
                  <p className={`text-lg font-black ${insufficientCredits ? "text-destructive" : "text-foreground"}`}>
                    {Number(creditBalance ?? 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Será debitado
                  </p>
                  <p className="text-lg font-black text-primary">{brl(deliveryFee)}</p>
                </div>
              </div>
            )}
            {insufficientCredits && (
              <p className="mb-3 text-xs font-bold text-destructive text-center">
                Créditos insuficientes para esta entrega. Solicite uma recarga em Financeiro &gt; Créditos.
              </p>
            )}
            <Button
              type="submit"
              disabled={busy || insufficientCredits}
              className="w-full rounded-2xl h-14 text-base font-black shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : editId ? "Salvar Alterações" : "Criar Solicitação de Entrega"}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
              {f.value && Number(f.value) > 0 ? (
                <>
                  Taxa de entrega: <strong className="text-primary">R$ {Number(f.value).toFixed(2)}</strong>
                </>
              ) : (
                <>
                  Taxa de entrega: <strong className="text-destructive">selecione uma região</strong>
                </>
              )}
            </p>
          </div>

        </form>
        )}
      </div>

      {/* ── MODAL MAPA TELA CHEIA (COM MIRA FIXA CENTRAL) ── */}
      {isMapFullscreen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 h-[100dvh] w-screen bg-background z-[9999] flex flex-col overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card shadow-sm">
            <div>
              <h3 className="font-bold text-base">Arrastar Mapa sob a Mira</h3>
              <p className="text-xs text-muted-foreground">Posicione a rua no centro da tela e clique para fixar o Destino</p>
            </div>
            <button
              onClick={() => setIsMapFullscreen(false)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Autocomplete de Pesquisa (Destino) */}
          <div className="p-3 bg-card border-b border-border relative z-55 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={dropoffText}
                onChange={(e) => {
                  setDropoffText(e.target.value);
                  searchAddress(e.target.value);
                }}
                placeholder="Buscar bairro, rua, local..."
                className="w-full pl-9 pr-4 h-11 rounded-xl border border-border bg-background text-sm shadow-sm"
              />
              <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />

              {dropoffSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto z-50">
                  {dropoffSuggestions.map((item, idx) => {
                    const label = formatSuggestionLabel(item);
                    return (
                      <button
                        key={idx}
                        onClick={() => selectSuggestion(item)}
                        className="w-full text-left px-3 py-3 hover:bg-muted border-b border-border/30 flex flex-col gap-0.5 text-foreground"
                      >
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="truncate">{label.main}</span>
                        </div>
                        <span className="pl-[22px] text-xs text-muted-foreground">{label.sub}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Div do Mapa com Alvo Central Fixo */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div ref={mapContainerFull} className="w-full h-full" />

            {/* ── MIRA CENTRAL DE PRECISÃO ── */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-30 flex flex-col items-center">
              <div className="px-3 py-1.5 rounded-xl shadow-lg text-[10px] font-black text-white whitespace-nowrap mb-1 animate-bounce bg-emerald-500">
                Ponto de Destino
              </div>
              <div className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-emerald-500" />
              <div className="w-0.5 h-6 bg-slate-800 shadow shadow-black/30" />
            </div>

            <div className="absolute bottom-20 left-4 right-4 bg-black/80 backdrop-blur text-white p-3 rounded-2xl text-[11px] text-center pointer-events-none shadow-lg z-20">
              <span className="font-semibold text-slate-300">Endereço no centro:</span>
              <p className="font-bold truncate mt-0.5 text-sm">
                {dropoffText || "Primavera do Leste"}
              </p>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-20">
              <Button
                onClick={handleSelectLocationAtCenter}
                className="w-full h-12 rounded-xl text-sm font-bold text-white shadow-lg bg-emerald-500 hover:bg-emerald-600"
              >
                Definir Destino Aqui
              </Button>
            </div>
          </div>

          <div className="p-4 bg-card border-t border-border flex gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsMapFullscreen(false)}
              className="flex-1 h-12 rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
