import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { normalizeConfig, type NewzpageConfig } from "@/lib/config-schema";
import { api } from "./api";
import { getConfigSnapshot, saveConfig, subscribeConfig } from "./config-store";

const serverSnapshot = () => undefined;

/**
 * The configuration lives in this browser. On a first visit the house defaults are fetched once and kept;
 * other tabs are followed through storage events. When storage is unavailable, the configuration is held in
 * memory for the life of the tab.
 */
export function useConfig() {
  const snapshot = useSyncExternalStore(subscribeConfig, getConfigSnapshot, serverSnapshot);
  const [fallback, setFallback] = useState<NewzpageConfig>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (snapshot !== null || fallback) return;
    let cancelled = false;
    api
      .defaults()
      .then((config) => {
        if (cancelled) return;
        if (!saveConfig(config)) setFallback(config);
      })
      .catch((caught: Error) => {
        if (cancelled) return;
        setFallback(normalizeConfig({}));
        setError(`The house defaults could not be loaded: ${caught.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot, fallback]);

  const save = useCallback((config: NewzpageConfig): boolean => {
    const written = saveConfig(config);
    if (!written) {
      setFallback(config);
      setError("This browser refuses to store the configuration; changes last until the tab closes.");
    }
    return written;
  }, []);

  const config = snapshot ?? fallback;
  return { config, ready: snapshot !== undefined && config !== undefined, error, save };
}
