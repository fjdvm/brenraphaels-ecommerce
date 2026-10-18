"use client";

import "leaflet/dist/leaflet.css";

import { LocateFixed, Navigation } from "lucide-react";
import type { CircleMarker, Map as LeafletMap, Polyline } from "leaflet";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { storeLocation } from "@/lib/site/store-info";
import { cn } from "@/lib/utils";

type Route = { distanceKm: number; minutes: number };
type Status = "idle" | "locating" | "routing" | "ready" | "error";

const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Live map of the shop. On request it asks for the visitor's location and draws the driving route to the shop. */
export function StoreMap({ place, className }: { place: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<Polyline | null>(null);
  const youAreHereRef = useRef<CircleMarker | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>();
  const [route, setRoute] = useState<Route>();

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [storeLocation.lat, storeLocation.lng],
        15,
      );
      L.tileLayer(tileUrl, { attribution: tileAttribution, maxZoom: 19 }).addTo(map);
      L.circleMarker([storeLocation.lat, storeLocation.lng], {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: "#4a2373",
        fillOpacity: 1,
      })
        .bindTooltip("Bren Raphael's", { permanent: true, direction: "top", offset: [0, -10] })
        .addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      youAreHereRef.current = null;
    };
  }, []);

  async function showRoute() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Your browser can't share its location.");
      return;
    }
    setStatus("locating");
    setMessage(undefined);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setStatus("routing");
        try {
          const from = `${coords.longitude},${coords.latitude}`;
          const to = `${storeLocation.lng},${storeLocation.lat}`;
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`,
          );
          const body = (await response.json()) as {
            routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
          };
          const found = body.routes?.[0];
          const map = mapRef.current;
          if (!response.ok || !found || !map) throw new Error("No route");

          const L = await import("leaflet");
          routeLayerRef.current?.remove();
          const path = found.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
          routeLayerRef.current = L.polyline(path, { color: "#4a2373", weight: 5, opacity: 0.85 }).addTo(map);
          youAreHereRef.current?.remove();
          youAreHereRef.current = L.circleMarker([coords.latitude, coords.longitude], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#2f7d57",
            fillOpacity: 1,
          })
            .bindTooltip("You are here", { direction: "top" })
            .addTo(map);
          map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
          setRoute({ distanceKm: found.distance / 1000, minutes: Math.round(found.duration / 60) });
          setStatus("ready");
        } catch {
          setStatus("error");
          setMessage("We couldn't plan a route right now. Please try again.");
        }
      },
      (error) => {
        setStatus("error");
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Allow location access in your browser to see the route from where you are."
            : "We couldn't find your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const busy = status === "locating" || status === "routing";
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${storeLocation.lat},${storeLocation.lng}`;

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[40px] bg-lavender-soft", className)}>
      <div aria-label={`Map — ${place}`} className="absolute inset-0 z-0" ref={containerRef} role="region" />
      <div className="absolute inset-x-4 top-4 z-[500] flex flex-wrap items-center gap-3 rounded-[24px] bg-white/95 p-3 pl-5 shadow-md">
        <p aria-live="polite" className="min-w-0 flex-1 text-xs leading-normal tracking-[0.35px] text-body">
          {route
            ? `${route.distanceKm.toFixed(1)} km · about ${route.minutes} min by car`
            : (message ?? place)}
        </p>
        {status === "ready" || status === "error" ? (
          <a
            className="text-xs font-medium text-primary hover:underline"
            href={directionsHref}
            rel="noreferrer"
            target="_blank"
          >
            Open in Maps
          </a>
        ) : null}
        <Button disabled={busy} onClick={showRoute} size="pill-sm" type="button" variant="pill">
          {status === "ready" ? <LocateFixed aria-hidden className="size-4" /> : <Navigation aria-hidden className="size-4" />}
          {status === "locating" ? "Locating…" : status === "routing" ? "Planning route…" : "Directions from my location"}
        </Button>
      </div>
    </div>
  );
}
