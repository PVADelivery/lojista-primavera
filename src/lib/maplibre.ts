import type * as MapLibreGL from "maplibre-gl";

let cached: typeof MapLibreGL | null = null;

/** Carrega o maplibre-gl dinamicamente (SSR-safe) e mantém em cache. */
export async function loadMapLibre(): Promise<typeof MapLibreGL> {
  if (!cached) {
    const mod: any = await import("maplibre-gl");
    cached = (mod.default ?? mod) as typeof MapLibreGL;
  }
  return cached;
}

/** Retorna o módulo já carregado (ou null se ainda não foi carregado). */
export function getMapLibre(): typeof MapLibreGL | null {
  return cached;
}

export type { MapLibreGL };
