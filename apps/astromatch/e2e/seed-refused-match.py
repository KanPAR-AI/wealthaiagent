"""Seed ONE refused match on the local throwaway account, so the PH-41
fixtures can be captured from the real serving path (docs/73 ASTRAL-340).

    docker exec -i yourfinadvisor_api python - < e2e/seed-refused-match.py
    docker exec -i yourfinadvisor_api python - <<< "DELETE" < …   # see below

WHY THIS EXISTS. A refused match is a first-class row on the matches surface
(ASTRAL-144) and a first-class COLUMN in compare (ASTRAL-340), and it cannot
be created from the product: `graph._persist_saved_match` returns early when
the chat holds no scorecard and its own comment says why — "the engine does
not yet persist a refusal into the envelope for this path to read, so
promoting one here would mean inventing it". The store's writer takes one
(`service.save_match(refusal=…)`) and the read side serves it.

So this seeds through the STORE'S OWN WRITER, with the refusal built by the
ENGINE'S OWN function (`matches.undetermined_refusal`) rather than by hand,
and the fixture is then captured from `GET /people/matches` — the real route,
the real serialisation.

It writes to whatever account the container is configured as. Check
`SKIP_AUTH_USER_ID` first (docs/51 §3). `python - seed` creates; `python -
delete` removes the person it created, which removes the match with it.
"""

import asyncio
import os
import sys

NAME = "Compare Walk Refused"

#: the ONLY uid this script will write to without an explicit override
THROWAWAY_UID = "local-dev-throwaway-uid"

#: …and the override, named so it cannot be set by accident or by habit
OVERRIDE_ENV = "ASTROMATCH_SEED_I_KNOW_THIS_WRITES_PRODUCTION"


async def main(mode: str) -> None:
    from services.people import matches as matches_mod
    from services.people import service

    owner = os.environ.get("SKIP_AUTH_USER_ID") or ""
    if not owner:
        raise SystemExit("no SKIP_AUTH_USER_ID — refusing to guess an owner")

    # ── FLAG-7 · THE TRAP THAT ONCE DESTROYED THE OWNER'S OWN RECORD ───────
    #
    # A local container is configured as a REAL user against the PRODUCTION
    # Firestore project (docs/51 §3): on 2026-08-25 a local run wrote the
    # owner's birth record as if it were a test account. This script creates
    # a person and a match, so it refuses to run as anybody but the throwaway
    # uid — and the override is an env var whose name has to be typed out in
    # full, on purpose.
    if owner != THROWAWAY_UID and not os.environ.get(OVERRIDE_ENV):
        raise SystemExit(
            f"REFUSING to seed: this container is configured as {owner!r}, "
            f"not {THROWAWAY_UID!r}.\n"
            "This script CREATES a person and a match on that account, and a "
            "local container writes the PRODUCTION Firestore (docs/51 §3).\n"
            f"If you really mean it, set {OVERRIDE_ENV}=1 — and read "
            "docs/51 §3 first."
        )
    if owner != THROWAWAY_UID:
        print(f"⚠ OVERRIDDEN: seeding as {owner!r}, not the throwaway uid. "
              f"{OVERRIDE_ENV} was set.")
    print(f"owner: {owner}")

    people = await service.list_people(owner)
    existing = [p for p in people if (p.display_name or "") == NAME]

    if mode == "delete":
        for person in existing:
            await service.delete_person(owner, person.id)
            print(f"deleted {person.id}")
        if not existing:
            print("nothing to delete")
        return

    if existing:
        print(f"already seeded: {existing[0].id}")
        return

    # The ENGINE's own refusal text, not a hand-written sentence. An empty
    # card yields the generic "whose Moon is undetermined" wording, which is
    # exactly what a record stored before ASTRAL-314's gate produces on read.
    refusal = matches_mod.undetermined_refusal({}, NAME)
    print(f"refusal: {refusal['reason'][:90]}…")

    out = await service.save_match(
        owner,
        consent={
            "ask": "save_match_offer",
            "disclosure_version": "seed",
            "disclosure_text": (
                "Seeded by apps/astromatch/e2e/seed-refused-match.py to capture "
                "a refused-row fixture. Synthetic person; deleted after capture."
            ),
        },
        other_values={
            # SYNTHETIC. A time-less birth on a rashi boundary is what a
            # refusal is about; no real person's details are used anywhere.
            "date_of_birth": "1990-08-02",
            "place_of_birth": "Ranchi, India",
        },
        other_provenance={
            "date_of_birth": "stated_by_user",
            "place_of_birth": "stated_by_user",
        },
        other_name=NAME,
        refusal=refusal,
    )
    print(f"seeded: {out}")


asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "seed"))
