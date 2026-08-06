/**
 * What this corpus has in flight, polled from the server's own job records.
 *
 * The numbers come from `_JobTrail` in the ingest endpoints — real stage
 * boundaries ("Fingerprinting", "Fetching the transcript", "Splitting into
 * passages"), not a client-side guess. That distinction is the whole point:
 * a bar driven by a timer will happily animate over work that has died.
 *
 * Polling stops when nothing is active. A screen that keeps asking every two
 * seconds forever costs a request per admin per two seconds for no information,
 * and the queue endpoint reads every job in the corpus.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchIngestQueue, type IngestQueueRow } from "@/services/corpus-video-service";

const POLL_MS = 2500;

export function useIngestProgress(corpusId: string, enabled = true) {
  const [rows, setRows] = useState<IngestQueueRow[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!corpusId) return;
    try {
      const res = await fetchIngestQueue(corpusId);
      if (!alive.current) return;
      setRows(res.queue || []);
      setActive(res.active || 0);
      setError("");
    } catch (e) {
      // A failed poll must not clear what is on screen: the last real progress
      // is better information than a blank, and a transient 502 would
      // otherwise look like the job vanished.
      if (alive.current) setError(String((e as Error)?.message || e));
    }
  }, [corpusId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !corpusId) return;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
    // `active` is deliberately in the deps: when it drops to zero the interval
    // is torn down and replaced by one that will stop after its own last poll,
    // so a finished queue settles instead of being asked about forever.
  }, [enabled, corpusId, refresh, active]);

  return { rows, active, error, refresh };
}
