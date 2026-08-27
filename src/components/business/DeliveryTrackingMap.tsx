import React, { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Truck, MapPin, Loader2 } from "lucide-react";
import { geocodeAddress } from "@/utils/freight";
import { loadMapLibre } from "@/lib/maplibre";
import { createDropoffPinElement, createVehicleMarkerElement, registerMapEmojis } from "@/lib/map-markers";

interface DeliveryTrackingMapProps {
  deliveryId: string;
  driverId?: string | null;
  destinationAddress?: string;
}

export default function DeliveryTrackingMap({ deliveryId, driverId, destinationAddress }: DeliveryTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || typeof window === "undefined") return;

    let isMounted = true;
    const initMap = async () => {
      try {
        setLoading(true);
        let destCoords: { lat: number; lng: number } | null = null;
        if (destinationAddress) {
          destCoords = await geocodeAddress(destinationAddress);
        }

        if (!mapContainerRef.current || !isMounted) {
          setLoading(false);
          return;
        }

        const maplibregl = await loadMapLibre();

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
          center: destCoords ? [destCoords.lng, destCoords.lat] : [-56.097, -15.601], // Default Cuiabá
          zoom: 14,
          attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), "bottom-right");
        mapRef.current = map;
        registerMapEmojis(map);

        if (destCoords) {
          new maplibregl.Marker({ element: createDropoffPinElement(), anchor: "bottom" })
            .setLngLat([destCoords.lng, destCoords.lat])
            .setPopup(new maplibregl.Popup().setHTML("<b>Destino</b>"))
            .addTo(map);
        }

        setLoading(false);
      } catch (error) {
        console.error("[TrackingMap] Error initializing map:", error);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [destinationAddress]);

  useEffect(() => {
    if (!mapRef.current || !driverId) return;

    // Monitor driver location in real-time
    const fetchAndMarkDriver = async () => {
      const maplibregl = await loadMapLibre();
      const { data: driver } = await supabase
        .from("delivery_drivers")
        .select("current_latitude, current_longitude")
        .eq("id", driverId)
        .single();

      if (driver?.current_latitude && driver?.current_longitude) {
        const coords: [number, number] = [driver.current_longitude, driver.current_latitude];
        
        if (!driverMarkerRef.current) {
          const el = createVehicleMarkerElement("moto");
          
          driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat(coords)
            .addTo(mapRef.current!);
        } else {
          driverMarkerRef.current.setLngLat(coords);
        }

        // Auto center/fit bounds if first time or moving significantly
        // mapRef.current.easeTo({ center: coords });
      }
    };

    fetchAndMarkDriver();

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_drivers", filter: `id=eq.${driverId}` },
        (payload) => {
          const { current_latitude, current_longitude } = payload.new;
          if (current_latitude && current_longitude && driverMarkerRef.current) {
            driverMarkerRef.current.setLngLat([current_longitude, current_latitude]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  return (
    <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-border/50 bg-muted/20">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carregando Mapa...</p>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {driverId && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl border border-white/20 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Entregador em Rota</p>
                <p className="text-xs font-black text-foreground leading-none">Acompanhando localização...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
