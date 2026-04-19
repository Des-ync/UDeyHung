"use client";

/**
 * MapView — Mapbox GL JS map with clustered restaurant pins.
 *
 * Architecture:
 *  - Uses react-map-gl (already in dependencies) with mapbox-gl
 *  - Cluster layer via built-in GeoJSON source cluster support
 *  - Hover over individual pin → RestaurantHoverCard
 *  - Click cluster → zoom to fit
 *  - "Use my location" button → browser geolocation → re-center + re-query
 *  - Syncs map bounds with restaurant list (parent callback)
 */

import { useRef, useState, useCallback, useEffect } from "react";
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  GeolocateControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl";
import mapboxgl from "mapbox-gl";
import type {
  CircleLayer,
  SymbolLayer,
} from "mapbox-gl";
import { MapPin, Star, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PRICE_LABELS } from "@/lib/utils/mapUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapRestaurant {
  id: string;
  slug: string;
  name: string;
  neighborhood: string;
  priceLevel: string;
  cuisineTags: string[];
  ratingAvg: number;
  ratingCount: number;
  coverPhoto: string | null;
  isOpenNow: boolean;
  latitude: number;
  longitude: number;
}

// ─── Layer styles ─────────────────────────────────────────────────────────────

const clusterCircleLayer: CircleLayer = {
  id: "clusters",
  type: "circle",
  source: "restaurants",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#0F7B5A",
      10, "#0a6349",
      25, "#064d37",
    ],
    "circle-radius": [
      "step",
      ["get", "point_count"],
      20,
      10, 25,
      25, 30,
    ],
    "circle-opacity": 0.92,
  },
};

const clusterCountLayer: SymbolLayer = {
  id: "cluster-count",
  type: "symbol",
  source: "restaurants",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 13,
  },
  paint: {
    "text-color": "#FFFFFF",
  },
};

const unclusteredPointLayer: CircleLayer = {
  id: "unclustered-point",
  type: "circle",
  source: "restaurants",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": "#0F7B5A",
    "circle-radius": 9,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#FFFFFF",
  },
};

// ─── Hover card ───────────────────────────────────────────────────────────────

function HoverCard({ restaurant }: { restaurant: MapRestaurant }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-[#E8E5E0] overflow-hidden w-56">
      {restaurant.coverPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.coverPhoto}
          alt={restaurant.name}
          className="w-full h-24 object-cover"
        />
      ) : (
        <div className="w-full h-24 bg-[#F5F2ED] flex items-center justify-center">
          <MapPin size={22} className="text-[#C5C0BB]" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold text-[#1A1A1A] line-clamp-1">
            {restaurant.name}
          </p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
              restaurant.isOpenNow
                ? "bg-green-50 text-green-700"
                : "bg-[#F5F2ED] text-[#8B8680]"
            }`}
          >
            {restaurant.isOpenNow ? "Open" : "Closed"}
          </span>
        </div>
        <p className="text-xs text-[#8B8680] mt-0.5">
          {restaurant.neighborhood.replace(/_/g, " ")} ·{" "}
          <span className="text-[#D4A853] font-medium">
            {PRICE_LABELS[restaurant.priceLevel] ?? "₵"}
          </span>
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Star size={11} className="text-[#D4A853] fill-[#D4A853]" />
          <span className="text-xs text-[#1A1A1A] tabular-nums">
            {restaurant.ratingAvg.toFixed(1)}
          </span>
          <span className="text-xs text-[#C5C0BB]">
            ({restaurant.ratingCount})
          </span>
        </div>
        <Link
          href={`/restaurants/${restaurant.slug}`}
          className="mt-2 flex items-center gap-1 text-xs text-[#0F7B5A] font-medium hover:underline"
        >
          Book a table
          <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MapViewProps {
  restaurants: MapRestaurant[];
  onBoundsChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
}

// Accra city centre
const ACCRA_CENTER = { longitude: -0.187, latitude: 5.6037, zoom: 12 };

export function MapView({ restaurants, onBoundsChange }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredRestaurant, setHoveredRestaurant] =
    useState<MapRestaurant | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const token = process.env["NEXT_PUBLIC_MAPBOX_TOKEN"] ?? "";

  // Build GeoJSON from restaurants — props spread into react-map-gl <Source>
  const geojson = {
    type: "geojson" as const,
    data: {
      type: "FeatureCollection",
      features: restaurants.map((r) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [r.longitude, r.latitude],
        },
        properties: {
          id: r.id,
          slug: r.slug,
          name: r.name,
          neighborhood: r.neighborhood,
          priceLevel: r.priceLevel,
          ratingAvg: r.ratingAvg,
          ratingCount: r.ratingCount,
          coverPhoto: r.coverPhoto ?? "",
          isOpenNow: r.isOpenNow,
          cuisineTags: JSON.stringify(r.cuisineTags),
        },
      })),
    },
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  };

  // Emit bounds to parent when map moves
  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current || !onBoundsChange) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onBoundsChange]);

  // Click cluster → zoom in
  const handleClusterClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      if (!features[0]) return;

      const clusterId = features[0].properties?.cluster_id as number;
      const source = map.getSource("restaurants") as mapboxgl.GeoJSONSource;

      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const geom = features[0].geometry as GeoJSON.Point;
        map.easeTo({
          center: [geom.coordinates[0]!, geom.coordinates[1]!],
          zoom: (zoom ?? 14) + 0.5,
        });
      } catch {
        // cluster may have been removed during zoom animation
      }
    },
    []
  );

  // Hover interactive layers (clusters or unclustered points)
  const handleMouseEnter = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!mapRef.current) return;
      mapRef.current.getCanvas().style.cursor = "pointer";

      const feature = e.features?.[0];
      if (!feature?.properties) return;

      // Only show hover card for unclustered individual points
      if (feature.layer?.id !== "unclustered-point") return;

      const props = feature.properties;
      setHoverCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      setHoveredRestaurant({
        id: props.id as string,
        slug: props.slug as string,
        name: props.name as string,
        neighborhood: props.neighborhood as string,
        priceLevel: props.priceLevel as string,
        cuisineTags: JSON.parse((props.cuisineTags as string) || "[]") as string[],
        ratingAvg: props.ratingAvg as number,
        ratingCount: props.ratingCount as number,
        coverPhoto: (props.coverPhoto as string) || null,
        isOpenNow: props.isOpenNow as boolean,
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = "";
    setHoveredRestaurant(null);
    setHoverCoords(null);
  }, []);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-[#E8E5E0]">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={ACCRA_CENTER}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onMoveEnd={handleMoveEnd}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={handleClusterClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation={false}
          showUserHeading={false}
        />

        <Source id="restaurants" {...geojson}>
          <Layer {...clusterCircleLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {hoveredRestaurant && hoverCoords && (
          <Popup
            longitude={hoverCoords.lng}
            latitude={hoverCoords.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            closeOnClick={false}
            className="mapbox-hover-popup"
          >
            <HoverCard restaurant={hoveredRestaurant} />
          </Popup>
        )}
      </Map>
    </div>
  );
}
