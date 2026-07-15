import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "@/services/companies";
import { toast } from "sonner";
import { RegionPickerGrid } from "@/components/business/RegionPickerGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, MapPin, Banknote, Car, Motorbike, Info, Phone, Search, Navigation, Maximize2, MapPinned, X, Check } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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

  // Form State
  const [f, setF] = useState({
    customer_name: "",
    customer_phone: "",
    customer_cpf: "",
    address: "",
    customer_address_number: "",
    customer_neighborhood: "",
    customer_address_complement: "",
    payment_method: "dinheiro",
    is_paid: false,
    order_value: "",
    change_for: "",
    vehicle_type: "moto",
    region_id: "none",
    value: "4.99", // Delivery fee (frete) padrão moto
    notes: "",
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
        customer_name: editingDelivery.customer_name || "",
        customer_phone: editingDelivery.customer_phone || "",
        customer_cpf: editingDelivery.customer_cpf || "",
        address: editingDelivery.address ? editingDelivery.address.split(" - ")[0] : "",
        customer_address_number: editingDelivery.customer_address_number || "",
        customer_neighborhood: editingDelivery.customer_neighborhood || "",
        customer_address_complement: editingDelivery.customer_address_complement || "",
        payment_method: editingDelivery.payment_method === "pago" ? "dinheiro" : editingDelivery.payment_method || "dinheiro",
        is_paid: editingDelivery.payment_method === "pago",
        order_value: editingDelivery.order_value ? String(editingDelivery.order_value) : "",
        change_for: editingDelivery.change_for ? String(editingDelivery.change_for) : "",
        vehicle_type: editingDelivery.vehicle_type || "moto",
        region_id: editingDelivery.region_id || "none",
        value: editingDelivery.value ? String(editingDelivery.value) : "4.99",
        notes: editingDelivery.notes || "",
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

  // Handle dynamic fee calculation based on distance
  useEffect(() => {
    if (f.region_id === "none" && routeDistance !== null) {
      let fee = 4.99 + (routeDistance * 2.00); // Moto
      if (f.vehicle_type === "carro") fee = 6.99 + (routeDistance * 3.00);
      if (f.vehicle_type === "carro_aberto") fee = 9.99 + (routeDistance * 4.00);
      setF(prev => ({ ...prev, value: fee.toFixed(2) }));
    }
  }, [routeDistance, f.vehicle_type, f.region_id]);

  // Customer search autocomplete query
  useEffect(() => {
    if (!company?.id || customerQuery.trim().length < 2) {
      setCustomerSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const clean = customerQuery.trim();
      const { data, error } = await supabase
        .from("customers")
        .select(`
          id,
          name,
          phone,
          cpf,
          addresses (
            id,
            street,
            number,
            complement,
            neighborhood,
            region_id,
            latitude,
            longitude
          )
        `)
        .eq("company_id", company.id)
        .or(`name.ilike.%${clean}%,phone.ilike.%${clean}%`)
        .limit(5);

      if (!error && data) {
        setCustomerSuggestions(data);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [customerQuery, company?.id]);

  // Load MapLibre GL - Small Map (Disabled interaction, just shows the route/markers)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = pickupCoords || [-54.3075, -15.5606];

    mapRef.current = new maplibregl.Map({
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

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pickupCoords]);

  // Load MapLibre GL - Fullscreen Modal
  useEffect(() => {
    if (!isMapFullscreen || !mapContainerFull.current || mapFull.current) return;

    const center = dropoffCoords || pickupCoords || [-54.3075, -15.5606];

    mapFull.current = new maplibregl.Map({
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

    mapFull.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    return () => {
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
    if (!map) return;

    // Handle pickup marker
    if (pickupCoords) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLngLat(pickupCoords);
      } else {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white border-2 border-white shadow-lg";
        el.innerHTML = "🏪";
        pickupMarkerRef.current = new maplibregl.Marker({ element: el })
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
        dropoffMarkerRef.current = new maplibregl.Marker({ element: el })
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

  const selectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setF((prev) => ({
      ...prev,
      customer_name: cust.name,
      customer_phone: cust.phone || "",
      customer_cpf: cust.cpf || "",
    }));

    if (cust.addresses && cust.addresses.length > 0) {
      const addr = cust.addresses[0];
      setF((prev) => ({
        ...prev,
        address: addr.street,
        customer_address_number: addr.number || "",
        customer_neighborhood: addr.neighborhood || "",
        customer_address_complement: addr.complement || "",
        region_id: addr.region_id || "none",
      }));

      if (addr.latitude && addr.longitude) {
        setDropoffCoords([addr.longitude, addr.latitude]);
      }
    }
    setShowSuggestions(false);
  };

  const handleRegionSelect = (fee: number, regionId: string, regionName: string) => {
    setF(prev => ({
      ...prev,
      region_id: regionId,
      value: fee.toFixed(2),
      customer_neighborhood: regionName,
    }));
    toast.success(`Região selecionada: ${regionName} - R$ ${fee.toFixed(2)}`);
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

    const fullAddress = `${f.address}, ${f.customer_address_number} - ${f.customer_neighborhood} ${f.customer_address_complement ? `(${f.customer_address_complement})` : ""
      }`;
    const shortId = "#" + Math.random().toString(36).substring(2, 6).toUpperCase();

    setBusy(true);

    try {
      // 1. Auto-save / Auto-update Customer in the database
      let custId = selectedCustomerId;
      const phoneClean = f.customer_phone.replace(/\D/g, "");

      if (f.customer_name.trim()) {
        const { data: existingCust } = await supabase
          .from("customers")
          .select("id")
          .eq("company_id", company.id)
          .eq("phone", phoneClean)
          .maybeSingle();

        const custPayload = {
          company_id: company.id,
          name: f.customer_name.trim(),
          phone: phoneClean || null,
          cpf: f.customer_cpf.replace(/\D/g, "") || null,
        };

        if (existingCust) {
          const { data: updatedCust } = await supabase
            .from("customers")
            .update(custPayload)
            .eq("id", existingCust.id)
            .select()
            .single();
          if (updatedCust) custId = updatedCust.id;
        } else {
          const { data: insertedCust } = await supabase
            .from("customers")
            .insert([custPayload])
            .select()
            .single();
          if (insertedCust) custId = insertedCust.id;
        }
      }

      // 2. Save Address if customer exists
      if (custId && f.address.trim()) {
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
            customer_name: f.customer_name,
            customer_phone: f.customer_phone,
            address: fullAddress,
            customer_address_number: f.customer_address_number,
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
        deliveryWrite = await supabase
          .from("deliveries")
          .insert([
            {
              company_id: company.id,
              short_id: shortId,
              customer_name: f.customer_name,
              customer_phone: f.customer_phone,
              address: fullAddress,
              customer_address_number: f.customer_address_number,
              customer_neighborhood: f.customer_neighborhood,
              customer_address_complement: f.customer_address_complement,
              payment_method: f.is_paid ? "pago" : f.payment_method,
              order_value: f.is_paid ? 0 : Number(f.order_value || 0),
              change_for: f.is_paid ? 0 : Number(f.change_for || 0),
              vehicle_type: f.vehicle_type,
              region_id: f.region_id === "none" ? null : f.region_id,
              value: Number(f.value || 0),
              notes: f.notes,
              status: "pending",
            },
          ])
          .select("*")
          .single();
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
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

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={submit} className="space-y-8 bg-card border border-border/40 p-6 sm:p-8 rounded-[2rem] shadow-sm">
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
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    required
                    className="rounded-xl h-11 bg-secondary/30"
                    placeholder="Ex: João da Silva"
                  />
                  {showSuggestions && customerSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {customerSuggestions.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => selectCustomer(cust)}
                          className="w-full text-left px-4 py-2 hover:bg-accent text-sm flex flex-col border-b border-border/20 last:border-b-0"
                        >
                          <span className="font-bold">{cust.name}</span>
                          <span className="text-xs text-muted-foreground">{cust.phone || "Sem telefone"}</span>
                        </button>
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
                    onFocus={() => setShowSuggestions(true)}
                    className="rounded-xl h-11 pl-9 bg-secondary/30"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CPF do Cliente (Opcional)</Label>
                <Input
                  value={f.customer_cpf}
                  onChange={(e) => setF({ ...f, customer_cpf: e.target.value })}
                  className="rounded-xl h-11 bg-secondary/30"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
          </section>

          {/* Seção: Endereço */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">2</span>
              Endereço de Destino
            </h3>
            <div className="space-y-4 p-5 rounded-[1.5rem] bg-secondary/20 border border-border/40">
              <div className="grid sm:grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-1.5">
                  <Label>Rua / Avenida</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={f.address}
                      onChange={(e) => setF({ ...f, address: e.target.value })}
                      required
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
                    required
                    className="rounded-xl h-11 bg-background"
                    placeholder="Ex: 123"
                  />
                </div>
              </div>
              {/* Região - Grid de cards igual ao É Pra Já */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Região de Entrega <span className="text-destructive">*</span></Label>
                <RegionPickerGrid
                  companyId={company?.id}
                  onRegionSelect={handleRegionSelect}
                  initialSelectedId={f.region_id !== "none" ? f.region_id : null}
                />
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
              </div>

              {/* Botão de Localização e Mapa */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeocodeSearch}
                  disabled={isGeocoding}
                  className="w-full rounded-xl flex items-center justify-center gap-2 h-11 border-dashed mb-4"
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  Buscar Endereço Digitado
                </Button>

                <Label className="text-xs text-muted-foreground mt-1 mb-1 block">
                  Ou você pode selecionar no mapa com precisão:
                </Label>

                {/* Miniatura do Mapa que abre Modal */}
                <div
                  onClick={() => setIsMapFullscreen(true)}
                  className="relative h-44 rounded-2xl overflow-hidden border border-border shadow-sm cursor-pointer group hover:opacity-95 transition-all mt-2"
                >
                  <div ref={mapContainerRef} className="w-full h-full pointer-events-none" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 flex items-center justify-center transition-all">
                    <span className="bg-background/90 backdrop-blur text-foreground px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-md">
                      <Maximize2 className="w-4 h-4 text-primary" />
                      Selecionar Local de Entrega
                    </span>
                  </div>
                </div>

                {routeDistance !== null && (
                  <p className="text-xs font-semibold text-primary mt-1">
                    Distância calculada: {routeDistance.toFixed(2)} KM
                  </p>
                )}
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
                          <SelectItem value="pix">PIX (Chave do Entregador)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-emerald-700 dark:text-emerald-400">Valor a Cobrar do Cliente (R$)</Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={f.order_value}
                          onChange={(e) => handleMoneyChange("order_value", e.target.value)}
                          required
                          className="rounded-xl h-11 pl-9 bg-background border-emerald-500/30 font-bold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {f.payment_method === "dinheiro" && (
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-emerald-700 dark:text-emerald-400">
                        Troco para (R$) - Deixe 0 se não precisar
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={f.change_for}
                        onChange={(e) => handleMoneyChange("change_for", e.target.value)}
                        className="rounded-xl h-11 bg-background border-emerald-500/30"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl h-14 text-base font-black shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : editId ? "Salvar Alterações" : "Criar Solicitação de Entrega"}
            </Button>
            {f.value && Number(f.value) > 0 && (
              <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
                Taxa de entrega: <strong className="text-primary">R$ {Number(f.value).toFixed(2)}</strong>
              </p>
            )}
          </div>
        </form>
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
