/**
 * use-recent-uploads — keeps the last few image uploads in localStorage so
 * the user can re-attach an existing file (e.g. their palm photo) into a
 * new chat with one tap, instead of re-uploading from disk every time.
 *
 * Design choices:
 *   - Per-user keying via Firebase uid so anonymous + signed-in trays don't
 *     collide on a shared device.
 *   - Image-only because the palm-reading flow is the primary use case;
 *     non-image attachments (PDFs, audio) clutter the tray and rarely repeat.
 *   - Capped at 6 entries; the picker shows the most recent 3.
 *   - Stores the BACKEND url (file_id is encoded in the path) so re-attaching
 *     skips the /files/upload roundtrip entirely — the existing GCS object
 *     is reused.
 */
import { useCallback, useEffect, useState } from "react";
import type { MessageFile } from "@/types/chat";
import { useAuthStore } from "@/store/auth";

const MAX_STORED = 6;

type StoredFile = MessageFile & { uploadedAt: number };

function storageKeyFor(uid: string | undefined | null): string {
  return `recent_uploads:${uid || "anon"}`;
}

function readStored(key: string): StoredFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f) => f && typeof f.url === "string" && typeof f.name === "string",
    );
  } catch {
    return [];
  }
}

function writeStored(key: string, items: StoredFile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Quota exceeded or storage disabled — non-fatal.
  }
}

export function useRecentUploads() {
  const uid = useAuthStore((s) => s.user?.uid);
  const key = storageKeyFor(uid);
  const [recents, setRecents] = useState<StoredFile[]>(() => readStored(key));

  // Re-read when the user identity changes (e.g. anon → signed-in).
  useEffect(() => {
    setRecents(readStored(key));
  }, [key]);

  const addRecent = useCallback(
    (file: MessageFile) => {
      // Only image attachments — palm photos are the primary use case.
      if (!file.type?.startsWith("image/")) return;
      setRecents((prev) => {
        // Dedupe by URL so the same file uploaded twice doesn't fill the tray.
        const without = prev.filter((p) => p.url !== file.url);
        const next = [{ ...file, uploadedAt: Date.now() }, ...without].slice(
          0,
          MAX_STORED,
        );
        writeStored(key, next);
        return next;
      });
    },
    [key],
  );

  const removeRecent = useCallback(
    (url: string) => {
      setRecents((prev) => {
        const next = prev.filter((p) => p.url !== url);
        writeStored(key, next);
        return next;
      });
    },
    [key],
  );

  // Convenience for the picker — strip the timestamp and cap to N.
  const visibleRecents = useCallback(
    (limit = 3): MessageFile[] =>
      recents.slice(0, limit).map(({ uploadedAt: _ts, ...file }) => file),
    [recents],
  );

  return { recents, addRecent, removeRecent, visibleRecents };
}
