// hooks/memory/use-entities.ts — entities data (UI-7 graph seed + entity
// picker autocomplete, MUI-1009). COMPONENT_MODEL "data-flow rule": the
// component never calls memory-engine-service.ts directly.
import { useEffect, useState } from "react";
import {
  listEntities,
  MemoryEngineError,
  type Entity,
} from "@/services/memory-engine-service";

export type EntitiesStatus = "loading" | "success" | "error";

/** All entities in the caller's own universe, optionally narrowed by a
 *  substring `query` (over canonical_name/aliases) or `entityType` — both
 *  a plain inclusion filter the BACKEND applies (never a client re-filter
 *  of a broader fetch, and never a ranking). */
export function useEntities(query?: string, entityType?: string) {
  const [status, setStatus] = useState<EntitiesStatus>("loading");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    listEntities({ q: query, type: entityType })
      .then((r) => {
        if (!alive) return;
        setEntities(r.entities);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof MemoryEngineError ? err.message : "Could not load entities.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [query, entityType]);

  return { status, entities, error };
}
