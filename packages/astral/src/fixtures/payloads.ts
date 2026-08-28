/**
 * CAPTURED FROM THE LIVE ENGINE, not hand-written.
 *
 * Produced on 2026-08-22 by calling `compute_natal_chart`, `compute_gun_milan`
 * and `compute_muhurta_windows` inside the running `yourfinadvisor_api`
 * container and dumping the exact dicts `graph.py` puts on the wire
 * (`chart_data` ~:1819, `{'type':'match_report', **result}` ~:4305,
 * `widget_data` ~:4028). Every field, every null and every float is the
 * engine's.
 *
 * They are fixtures, so they are frozen on purpose: if the engine changes
 * shape, these stop matching it and a test that depends on the shape should
 * fail loudly rather than a renderer quietly degrading. Re-capture, do not
 * hand-edit.
 *
 * Datasets
 *   natalTimed      14 May 1994 10:30, Austin TX (docs/49 F1's own birth data)
 *   natalTimeless   the same birth WITHOUT a time -> ascendant null, houses [],
 *                   every planet.house null, one Moon nakshatra alternative
 *   natalPartner     2 Nov 1992 06:15, Pune
 *   matchTimed      the two timed charts -> 21.5 / 36, "acceptable"
 *   matchTimeless   Austin-without-a-time vs Pune -> total null, firm 5 of 15,
 *                   21 pending, verdict "incomplete", 4 kootas pending
 *   muhurta         1-5 Sep 2026, Pune, 320 slots evaluated, 10 windows
 *   inputRequest    the birth-time ask (docs/49 ASTRAL-83), captured from
 *                   `node_ask_user(rt, "birth_time_unlocks")` on a natal
 *                   belief that already has a date and a place
 *   birthDetailsAsk the ask a FRESH user meets (docs/49 ASTRAL-96), captured
 *                   from `_input_request_block("required_slots_missing",
 *                   Belief(intent="natal"), "en")` on 2026-08-24 — three
 *                   fields, `date`/`time`/`place`, with the time optional in
 *                   the only sense that matters: it carries "I don't know"
 *   placeChoiceAsk  the contested place (docs/49 ASTRAL-94/95), captured from
 *                   `_input_request_block("place_zone_unresolved", …)` with
 *                   the real gazetteer's two Springfields. The options are
 *                   PLACES; there is no IANA identifier anywhere in it
 *   correctionAsk   the in-place edit (docs/49 ASTRAL-138 as amended
 *                   2026-08-26), captured on 2026-08-26 from
 *                   `_input_request_block("field_correction", belief, "en",
 *                   "Please correct my birth time.")` over a belief holding
 *                   00:20. ONE field, and the first payload in this file to
 *                   carry `value` — the value the engine already holds, so
 *                   the picker opens AT it
 *   correctionPlaceAsk  the same ask for `pob`, which is the one whose
 *                   correction also kills the coordinates
 *   palmUploadAsk   the palm capture ask (bug 8dc95a6a), captured on
 *                   2026-08-28 from `_input_request_block(
 *                   "palm_intent_needs_upload", Belief(intent="palm"), "en")`
 *                   — two `image` fields, each LABELLED with its role, and
 *                   neither of them required: one usable photo is a real
 *                   reading, not a failed two-hand one
 *   palmHandednessAsk the one-time handedness question, same capture, from
 *                   `_input_request_block("handedness_for_palm", …)`
 *   palmTwoHand     a two-hand `palm_analysis` widget payload (docs/49
 *                   ASTRAL-48/49). **Provenance, stated precisely because it
 *                   differs from every other fixture here:** no palm
 *                   PHOTOGRAPH existed in this environment on 2026-08-28, so
 *                   the vision pass could not be driven live. Everything
 *                   downstream of it WAS: `combine_hand_analyses`,
 *                   `palm_rules.classical_rules_payload` (which derived the
 *                   features and fired 7 of 38 rules on its own) and
 *                   `palm.reading_headline` were executed inside the running
 *                   container over `palm.py`'s OWN vision exemplar
 *                   (`palm.py:140-170`, the JSON the model is instructed to
 *                   emit). The two hands, the pairing, the citations, the
 *                   abstention count and the label are the engine's. Re-
 *                   capture from a real photo when one is available.
 */

export const natalTimedPayload = {
  "type": "natal_chart",
  "ascendant": "Gemini",
  "ascendant_degree": 85.25,
  "ascendant_sign_degree": 25.25,
  "moon_sign": "Gemini",
  "sun_sign": "Aries",
  "planets": [
    {
      "planet": "Sun",
      "sign": "Aries",
      "house": 11,
      "degree": 29.82,
      "sign_degree": 29.82,
      "nakshatra": "Krittika",
      "nakshatra_pada": 1,
      "retrograde": false,
      "dignity": "exalted"
    },
    {
      "planet": "Moon",
      "sign": "Gemini",
      "house": 12,
      "degree": 73.42,
      "sign_degree": 13.42,
      "nakshatra": "Ardra",
      "nakshatra_pada": 3,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Mercury",
      "sign": "Taurus",
      "house": 11,
      "degree": 45.55,
      "sign_degree": 15.55,
      "nakshatra": "Rohini",
      "nakshatra_pada": 2,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Venus",
      "sign": "Taurus",
      "house": 12,
      "degree": 58.5,
      "sign_degree": 28.5,
      "nakshatra": "Mrigashira",
      "nakshatra_pada": 2,
      "retrograde": false,
      "dignity": "own sign"
    },
    {
      "planet": "Mars",
      "sign": "Pisces",
      "house": 10,
      "degree": 359.2,
      "sign_degree": 29.2,
      "nakshatra": "Revati",
      "nakshatra_pada": 4,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Jupiter",
      "sign": "Libra",
      "house": 4,
      "degree": 194.22,
      "sign_degree": 14.22,
      "nakshatra": "Swati",
      "nakshatra_pada": 3,
      "retrograde": true,
      "dignity": "neutral"
    },
    {
      "planet": "Saturn",
      "sign": "Aquarius",
      "house": 8,
      "degree": 317.36,
      "sign_degree": 17.36,
      "nakshatra": "Shatabhisha",
      "nakshatra_pada": 4,
      "retrograde": false,
      "dignity": "own sign"
    },
    {
      "planet": "Rahu",
      "sign": "Scorpio",
      "house": 5,
      "degree": 210.01,
      "sign_degree": 0.01,
      "nakshatra": "Vishakha",
      "nakshatra_pada": 4,
      "retrograde": true,
      "dignity": "neutral"
    },
    {
      "planet": "Ketu",
      "sign": "Taurus",
      "house": 11,
      "degree": 30.01,
      "sign_degree": 0.01,
      "nakshatra": "Krittika",
      "nakshatra_pada": 2,
      "retrograde": true,
      "dignity": "neutral"
    }
  ],
  "houses": [
    {
      "house": 1,
      "sign": "Gemini",
      "degree": 60.0,
      "sign_degree": 0.0,
      "lord": "Mercury"
    },
    {
      "house": 2,
      "sign": "Cancer",
      "degree": 90.0,
      "sign_degree": 0.0,
      "lord": "Moon"
    },
    {
      "house": 3,
      "sign": "Leo",
      "degree": 120.0,
      "sign_degree": 0.0,
      "lord": "Sun"
    },
    {
      "house": 4,
      "sign": "Virgo",
      "degree": 150.0,
      "sign_degree": 0.0,
      "lord": "Mercury"
    },
    {
      "house": 5,
      "sign": "Libra",
      "degree": 180.0,
      "sign_degree": 0.0,
      "lord": "Venus"
    },
    {
      "house": 6,
      "sign": "Scorpio",
      "degree": 210.0,
      "sign_degree": 0.0,
      "lord": "Mars"
    },
    {
      "house": 7,
      "sign": "Sagittarius",
      "degree": 240.0,
      "sign_degree": 0.0,
      "lord": "Jupiter"
    },
    {
      "house": 8,
      "sign": "Capricorn",
      "degree": 270.0,
      "sign_degree": 0.0,
      "lord": "Saturn"
    },
    {
      "house": 9,
      "sign": "Aquarius",
      "degree": 300.0,
      "sign_degree": 0.0,
      "lord": "Saturn"
    },
    {
      "house": 10,
      "sign": "Pisces",
      "degree": 330.0,
      "sign_degree": 0.0,
      "lord": "Jupiter"
    },
    {
      "house": 11,
      "sign": "Aries",
      "degree": 0.0,
      "sign_degree": 0.0,
      "lord": "Mars"
    },
    {
      "house": 12,
      "sign": "Taurus",
      "degree": 30.0,
      "sign_degree": 0.0,
      "lord": "Venus"
    }
  ],
  "dasha_periods": [
    {
      "planet": "Rahu",
      "start_date": "1994-05-14",
      "end_date": "2003-03-31",
      "is_current": false
    },
    {
      "planet": "Jupiter",
      "start_date": "2003-03-31",
      "end_date": "2019-03-31",
      "is_current": false
    },
    {
      "planet": "Saturn",
      "start_date": "2019-03-31",
      "end_date": "2038-03-30",
      "is_current": true
    },
    {
      "planet": "Mercury",
      "start_date": "2038-03-30",
      "end_date": "2055-03-30",
      "is_current": false
    },
    {
      "planet": "Ketu",
      "start_date": "2055-03-30",
      "end_date": "2062-03-29",
      "is_current": false
    },
    {
      "planet": "Venus",
      "start_date": "2062-03-29",
      "end_date": "2082-03-29",
      "is_current": false
    },
    {
      "planet": "Sun",
      "start_date": "2082-03-29",
      "end_date": "2088-03-28",
      "is_current": false
    },
    {
      "planet": "Moon",
      "start_date": "2088-03-28",
      "end_date": "2098-03-28",
      "is_current": false
    },
    {
      "planet": "Mars",
      "start_date": "2098-03-28",
      "end_date": "2105-03-28",
      "is_current": false
    },
    {
      "planet": "Rahu",
      "start_date": "2105-03-28",
      "end_date": "2123-03-28",
      "is_current": false
    },
    {
      "planet": "Jupiter",
      "start_date": "2123-03-28",
      "end_date": "2139-03-28",
      "is_current": false
    },
    {
      "planet": "Saturn",
      "start_date": "2139-03-28",
      "end_date": "2158-03-27",
      "is_current": false
    }
  ],
  "yogas": [
    "Budhaditya Yoga (Sun-Mercury conjunction — intelligence, communication skills)",
    "Raj Yoga (kendra-trikona lord connection via Mercury — power, authority)"
  ],
  "zodiac_mode": "sidereal",
  "ayanamsa": "LAHIRI",
  "house_system": "W",
  "time_known": true,
  "moon_sign_alternatives": [],
  "moon_nakshatra_alternatives": [],
  "birth_data": {
    "date_of_birth": "1994-05-14",
    "time_of_birth": "10:30",
    "time_known": true,
    "place_of_birth": "Austin, Texas, USA",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "timezone": "America/Chicago"
  }
} as const;

export const natalTimelessPayload = {
  "type": "natal_chart",
  "ascendant": null,
  "ascendant_degree": null,
  "ascendant_sign_degree": null,
  "moon_sign": "Gemini",
  "sun_sign": "Aries",
  "planets": [
    {
      "planet": "Sun",
      "sign": "Aries",
      "house": null,
      "degree": 29.88,
      "sign_degree": 29.88,
      "nakshatra": "Krittika",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "exalted"
    },
    {
      "planet": "Moon",
      "sign": "Gemini",
      "house": null,
      "degree": 74.2,
      "sign_degree": 14.2,
      "nakshatra": "Ardra",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Mercury",
      "sign": "Taurus",
      "house": null,
      "degree": 45.66,
      "sign_degree": 15.66,
      "nakshatra": "Rohini",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Venus",
      "sign": "Taurus",
      "house": null,
      "degree": 58.58,
      "sign_degree": 28.58,
      "nakshatra": "Mrigashira",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "own sign"
    },
    {
      "planet": "Mars",
      "sign": "Pisces",
      "house": null,
      "degree": 359.25,
      "sign_degree": 29.25,
      "nakshatra": "Revati",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "friend's sign"
    },
    {
      "planet": "Jupiter",
      "sign": "Libra",
      "house": null,
      "degree": 194.22,
      "sign_degree": 14.22,
      "nakshatra": "Swati",
      "nakshatra_pada": null,
      "retrograde": true,
      "dignity": "neutral"
    },
    {
      "planet": "Saturn",
      "sign": "Aquarius",
      "house": null,
      "degree": 317.37,
      "sign_degree": 17.37,
      "nakshatra": "Shatabhisha",
      "nakshatra_pada": null,
      "retrograde": false,
      "dignity": "own sign"
    },
    {
      "planet": "Rahu",
      "sign": "Scorpio",
      "house": null,
      "degree": 210.01,
      "sign_degree": 0.01,
      "nakshatra": "Vishakha",
      "nakshatra_pada": null,
      "retrograde": true,
      "dignity": "neutral"
    },
    {
      "planet": "Ketu",
      "sign": "Taurus",
      "house": null,
      "degree": 30.01,
      "sign_degree": 0.01,
      "nakshatra": "Krittika",
      "nakshatra_pada": null,
      "retrograde": true,
      "dignity": "neutral"
    }
  ],
  "houses": [],
  "dasha_periods": [
    {
      "planet": "Rahu",
      "start_date": "1994-05-14",
      "end_date": "2002-03-15",
      "is_current": false
    },
    {
      "planet": "Jupiter",
      "start_date": "2002-03-15",
      "end_date": "2018-03-15",
      "is_current": false
    },
    {
      "planet": "Saturn",
      "start_date": "2018-03-15",
      "end_date": "2037-03-14",
      "is_current": true
    },
    {
      "planet": "Mercury",
      "start_date": "2037-03-14",
      "end_date": "2054-03-14",
      "is_current": false
    },
    {
      "planet": "Ketu",
      "start_date": "2054-03-14",
      "end_date": "2061-03-13",
      "is_current": false
    },
    {
      "planet": "Venus",
      "start_date": "2061-03-13",
      "end_date": "2081-03-13",
      "is_current": false
    },
    {
      "planet": "Sun",
      "start_date": "2081-03-13",
      "end_date": "2087-03-13",
      "is_current": false
    },
    {
      "planet": "Moon",
      "start_date": "2087-03-13",
      "end_date": "2097-03-12",
      "is_current": false
    },
    {
      "planet": "Mars",
      "start_date": "2097-03-12",
      "end_date": "2104-03-12",
      "is_current": false
    },
    {
      "planet": "Rahu",
      "start_date": "2104-03-12",
      "end_date": "2122-03-12",
      "is_current": false
    },
    {
      "planet": "Jupiter",
      "start_date": "2122-03-12",
      "end_date": "2138-03-12",
      "is_current": false
    },
    {
      "planet": "Saturn",
      "start_date": "2138-03-12",
      "end_date": "2157-03-11",
      "is_current": false
    }
  ],
  "yogas": [],
  "zodiac_mode": "sidereal",
  "ayanamsa": "LAHIRI",
  "house_system": "W",
  "time_known": false,
  "moon_sign_alternatives": [],
  "moon_nakshatra_alternatives": [
    "Punarvasu"
  ],
  "birth_data": {
    "date_of_birth": "1994-05-14",
    "time_of_birth": null,
    "time_known": false,
    "place_of_birth": "Austin, Texas, USA",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "timezone": "America/Chicago"
  }
} as const;

export const natalPartnerPayload = {
  "type": "natal_chart",
  "ascendant": "Libra",
  "ascendant_degree": 190.72,
  "ascendant_sign_degree": 10.72,
  "moon_sign": "Capricorn",
  "sun_sign": "Libra",
  "planets": [
    {
      "planet": "Sun",
      "sign": "Libra",
      "house": 1,
      "degree": 196.09,
      "sign_degree": 16.09,
      "nakshatra": "Swati",
      "nakshatra_pada": 3,
      "retrograde": false,
      "dignity": "debilitated"
    },
    {
      "planet": "Moon",
      "sign": "Capricorn",
      "house": 4,
      "degree": 282.25,
      "sign_degree": 12.25,
      "nakshatra": "Shravana",
      "nakshatra_pada": 1,
      "retrograde": false,
      "dignity": "neutral"
    },
    {
      "planet": "Mercury",
      "sign": "Scorpio",
      "house": 1,
      "degree": 219.59,
      "sign_degree": 9.59,
      "nakshatra": "Anuradha",
      "nakshatra_pada": 2,
      "retrograde": false,
      "dignity": "neutral"
    },
    {
      "planet": "Venus",
      "sign": "Scorpio",
      "house": 2,
      "degree": 232.36,
      "sign_degree": 22.36,
      "nakshatra": "Jyeshtha",
      "nakshatra_pada": 2,
      "retrograde": false,
      "dignity": "neutral"
    },
    {
      "planet": "Mars",
      "sign": "Gemini",
      "house": 9,
      "degree": 89.49,
      "sign_degree": 29.49,
      "nakshatra": "Punarvasu",
      "nakshatra_pada": 3,
      "retrograde": false,
      "dignity": "neutral"
    },
    {
      "planet": "Jupiter",
      "sign": "Virgo",
      "house": 12,
      "degree": 160.83,
      "sign_degree": 10.83,
      "nakshatra": "Hasta",
      "nakshatra_pada": 1,
      "retrograde": false,
      "dignity": "neutral"
    },
    {
      "planet": "Saturn",
      "sign": "Capricorn",
      "house": 4,
      "degree": 288.3,
      "sign_degree": 18.3,
      "nakshatra": "Shravana",
      "nakshatra_pada": 3,
      "retrograde": false,
      "dignity": "own sign"
    },
    {
      "planet": "Rahu",
      "sign": "Scorpio",
      "house": 2,
      "degree": 238.64,
      "sign_degree": 28.64,
      "nakshatra": "Jyeshtha",
      "nakshatra_pada": 4,
      "retrograde": true,
      "dignity": "neutral"
    },
    {
      "planet": "Ketu",
      "sign": "Taurus",
      "house": 8,
      "degree": 58.64,
      "sign_degree": 28.64,
      "nakshatra": "Mrigashira",
      "nakshatra_pada": 2,
      "retrograde": true,
      "dignity": "neutral"
    }
  ],
  "houses": [
    {
      "house": 1,
      "sign": "Libra",
      "degree": 180.0,
      "sign_degree": 0.0,
      "lord": "Venus"
    },
    {
      "house": 2,
      "sign": "Scorpio",
      "degree": 210.0,
      "sign_degree": 0.0,
      "lord": "Mars"
    },
    {
      "house": 3,
      "sign": "Sagittarius",
      "degree": 240.0,
      "sign_degree": 0.0,
      "lord": "Jupiter"
    },
    {
      "house": 4,
      "sign": "Capricorn",
      "degree": 270.0,
      "sign_degree": 0.0,
      "lord": "Saturn"
    },
    {
      "house": 5,
      "sign": "Aquarius",
      "degree": 300.0,
      "sign_degree": 0.0,
      "lord": "Saturn"
    },
    {
      "house": 6,
      "sign": "Pisces",
      "degree": 330.0,
      "sign_degree": 0.0,
      "lord": "Jupiter"
    },
    {
      "house": 7,
      "sign": "Aries",
      "degree": 0.0,
      "sign_degree": 0.0,
      "lord": "Mars"
    },
    {
      "house": 8,
      "sign": "Taurus",
      "degree": 30.0,
      "sign_degree": 0.0,
      "lord": "Venus"
    },
    {
      "house": 9,
      "sign": "Gemini",
      "degree": 60.0,
      "sign_degree": 0.0,
      "lord": "Mercury"
    },
    {
      "house": 10,
      "sign": "Cancer",
      "degree": 90.0,
      "sign_degree": 0.0,
      "lord": "Moon"
    },
    {
      "house": 11,
      "sign": "Leo",
      "degree": 120.0,
      "sign_degree": 0.0,
      "lord": "Sun"
    },
    {
      "house": 12,
      "sign": "Virgo",
      "degree": 150.0,
      "sign_degree": 0.0,
      "lord": "Mercury"
    }
  ],
  "dasha_periods": [
    {
      "planet": "Moon",
      "start_date": "1992-11-02",
      "end_date": "2001-02-24",
      "is_current": false
    },
    {
      "planet": "Mars",
      "start_date": "2001-02-24",
      "end_date": "2008-02-24",
      "is_current": false
    },
    {
      "planet": "Rahu",
      "start_date": "2008-02-24",
      "end_date": "2026-02-23",
      "is_current": false
    },
    {
      "planet": "Jupiter",
      "start_date": "2026-02-23",
      "end_date": "2042-02-23",
      "is_current": true
    },
    {
      "planet": "Saturn",
      "start_date": "2042-02-23",
      "end_date": "2061-02-22",
      "is_current": false
    },
    {
      "planet": "Mercury",
      "start_date": "2061-02-22",
      "end_date": "2078-02-22",
      "is_current": false
    },
    {
      "planet": "Ketu",
      "start_date": "2078-02-22",
      "end_date": "2085-02-21",
      "is_current": false
    },
    {
      "planet": "Venus",
      "start_date": "2085-02-21",
      "end_date": "2105-02-22",
      "is_current": false
    },
    {
      "planet": "Sun",
      "start_date": "2105-02-22",
      "end_date": "2111-02-22",
      "is_current": false
    },
    {
      "planet": "Moon",
      "start_date": "2111-02-22",
      "end_date": "2121-02-21",
      "is_current": false
    },
    {
      "planet": "Mars",
      "start_date": "2121-02-21",
      "end_date": "2128-02-21",
      "is_current": false
    },
    {
      "planet": "Rahu",
      "start_date": "2128-02-21",
      "end_date": "2146-02-20",
      "is_current": false
    }
  ],
  "yogas": [
    "Budhaditya Yoga (Sun-Mercury conjunction — intelligence, communication skills)",
    "Raj Yoga (kendra-trikona lord connection via Venus, Saturn — power, authority)",
    "Sasa Yoga (Saturn in kendra in dignity — discipline, leadership)"
  ],
  "zodiac_mode": "sidereal",
  "ayanamsa": "LAHIRI",
  "house_system": "W",
  "time_known": true,
  "moon_sign_alternatives": [],
  "moon_nakshatra_alternatives": [],
  "birth_data": {
    "date_of_birth": "1992-11-02",
    "time_of_birth": "06:15",
    "time_known": true,
    "place_of_birth": "Pune, Maharashtra, India",
    "latitude": 18.5204,
    "longitude": 73.8567,
    "timezone": "Asia/Kolkata"
  }
} as const;

export const matchTimedPayload = {
  "type": "match_report",
  "groom": {
    "moon_rashi": "Gemini",
    "nakshatra": "Ardra",
    "manglik": false,
    "time_known": true,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": []
  },
  "bride": {
    "moon_rashi": "Capricorn",
    "nakshatra": "Shravana",
    "manglik": false,
    "time_known": true,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": []
  },
  "kootas": [
    {
      "name": "Varna",
      "points": 0.0,
      "max": 1,
      "note": "Shudra + Vaishya",
      "meaning": "spiritual compatibility & ego balance",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Vashya",
      "points": 1.0,
      "max": 2,
      "note": "Manava + Chatushpada",
      "meaning": "mutual influence & attraction",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Tara",
      "points": 1.5,
      "max": 3,
      "note": "birth-star counting both ways",
      "meaning": "destiny & shared fortune",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Yoni",
      "points": 2.0,
      "max": 4,
      "note": "Dog + Monkey",
      "meaning": "physical & instinctive harmony",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Graha Maitri",
      "points": 4.0,
      "max": 5,
      "note": "Mercury (neutral of Saturn) / Saturn (friend of Mercury)",
      "meaning": "mental connection & friendship",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Gana",
      "points": 5.0,
      "max": 6,
      "note": "Manushya + Deva",
      "meaning": "temperament match",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Bhakoot",
      "points": 0.0,
      "max": 7,
      "note": "8/6 placement — Bhakoot dosha",
      "meaning": "prosperity & family welfare",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Nadi",
      "points": 8.0,
      "max": 8,
      "note": "Adi + Antya",
      "meaning": "health & progeny",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    }
  ],
  "time_known": true,
  "total": 21.5,
  "max_total": 36,
  "firm_total": 21.5,
  "firm_max": 36,
  "pending_max": 0,
  "pending_reasons": [],
  "verdict": "acceptable",
  "doshas": [
    {
      "name": "Bhakoot dosha",
      "detail": "Moon signs sit in a 6/8, 5/9 or 2/12 relationship — traditionally read as friction in prosperity and family life; mitigated when the sign lords are friends.",
      "provisional": false
    }
  ]
} as const;

export const matchTimelessPayload = {
  "type": "match_report",
  "groom": {
    "moon_rashi": "Gemini",
    "nakshatra": null,
    "manglik": null,
    "time_known": false,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": [
      "Punarvasu"
    ]
  },
  "bride": {
    "moon_rashi": "Capricorn",
    "nakshatra": "Shravana",
    "manglik": false,
    "time_known": true,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": []
  },
  "kootas": [
    {
      "name": "Varna",
      "points": 0.0,
      "max": 1,
      "note": "Shudra + Vaishya",
      "meaning": "spiritual compatibility & ego balance",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Vashya",
      "points": 1.0,
      "max": 2,
      "note": "Manava + Chatushpada",
      "meaning": "mutual influence & attraction",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Tara",
      "points": null,
      "max": 3,
      "note": "needs a birth time — this koota is read from the Moon's nakshatra",
      "meaning": "destiny & shared fortune",
      "time_dependent": true,
      "pending": true,
      "provisional": false
    },
    {
      "name": "Yoni",
      "points": null,
      "max": 4,
      "note": "needs a birth time — this koota is read from the Moon's nakshatra",
      "meaning": "physical & instinctive harmony",
      "time_dependent": true,
      "pending": true,
      "provisional": false
    },
    {
      "name": "Graha Maitri",
      "points": 4.0,
      "max": 5,
      "note": "Mercury (neutral of Saturn) / Saturn (friend of Mercury)",
      "meaning": "mental connection & friendship",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Gana",
      "points": null,
      "max": 6,
      "note": "needs a birth time — this koota is read from the Moon's nakshatra",
      "meaning": "temperament match",
      "time_dependent": true,
      "pending": true,
      "provisional": false
    },
    {
      "name": "Bhakoot",
      "points": 0.0,
      "max": 7,
      "note": "8/6 placement — Bhakoot dosha",
      "meaning": "prosperity & family welfare",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Nadi",
      "points": null,
      "max": 8,
      "note": "needs a birth time — this koota is read from the Moon's nakshatra",
      "meaning": "health & progeny",
      "time_dependent": true,
      "pending": true,
      "provisional": false
    }
  ],
  "time_known": false,
  "total": null,
  "max_total": null,
  "firm_total": 5.0,
  "firm_max": 15,
  "pending_max": 21,
  "pending_reasons": [
    "Nadi dosha (health and progeny) cannot be checked without both birth times — it is read from the Moon's nakshatra.",
    "Mangal (Kuja) dosha needs Mars's house, which needs a birth time — it is not assessed here."
  ],
  "verdict": "incomplete",
  "doshas": [
    {
      "name": "Bhakoot dosha",
      "detail": "Moon signs sit in a 6/8, 5/9 or 2/12 relationship — traditionally read as friction in prosperity and family life; mitigated when the sign lords are friends.",
      "provisional": false
    }
  ]
} as const;

export const muhurtaPayload = {
  "type": "muhurta_results",
  "location": "Pune, Maharashtra, India",
  "date_range": "2026-09-01 to 2026-09-05",
  "total_evaluated": 320,
  "windows": [
    {
      "start": "2026-09-01T14:15:00+05:30",
      "end": "2026-09-01T14:30:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    },
    {
      "start": "2026-09-01T14:30:00+05:30",
      "end": "2026-09-01T14:45:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    },
    {
      "start": "2026-09-01T14:45:00+05:30",
      "end": "2026-09-01T15:00:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    },
    {
      "start": "2026-09-01T15:00:00+05:30",
      "end": "2026-09-01T15:15:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    },
    {
      "start": "2026-09-01T15:15:00+05:30",
      "end": "2026-09-01T15:30:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 3,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": false,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Cho"
    },
    {
      "start": "2026-09-01T15:30:00+05:30",
      "end": "2026-09-01T15:45:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 3,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": false,
      "benefics": [
        "Jupiter in house 7",
        "Venus in house 10"
      ],
      "malefics": [],
      "naming_letter": "Cho"
    },
    {
      "start": "2026-09-01T15:45:00+05:30",
      "end": "2026-09-01T16:00:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 3,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": false,
      "benefics": [
        "Jupiter in house 7",
        "Venus in house 10"
      ],
      "malefics": [],
      "naming_letter": "Cho"
    },
    {
      "start": "2026-09-01T16:00:00+05:30",
      "end": "2026-09-01T16:15:00+05:30",
      "score": 0.88,
      "lagna": "Sagittarius",
      "lagna_lord": "Jupiter",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 3,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": false,
      "benefics": [
        "Jupiter in house 7",
        "Venus in house 10"
      ],
      "malefics": [],
      "naming_letter": "Cho"
    },
    {
      "start": "2026-09-01T14:00:00+05:30",
      "end": "2026-09-01T14:15:00+05:30",
      "score": 0.855,
      "lagna": "Scorpio",
      "lagna_lord": "Mars",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Venus in house 10",
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    },
    {
      "start": "2026-09-01T13:45:00+05:30",
      "end": "2026-09-01T14:00:00+05:30",
      "score": 0.83,
      "lagna": "Scorpio",
      "lagna_lord": "Mars",
      "moon_sign": "Aries",
      "nakshatra": "Ashwini",
      "pada": 2,
      "tithi": "Panchami",
      "yoga": "Vriddhi",
      "karana": "Vanija",
      "vara": "Mangalvar",
      "rahu_kaal": true,
      "benefics": [
        "Mercury in house 9"
      ],
      "malefics": [],
      "naming_letter": "Che"
    }
  ]
} as const;

export const inputRequestPayload = {
  "type": "input_request",
  "ask": "birth_time_unlocks",
  "reason": "A birth time unlocks the Lagna, the twelve bhavas and 21 of the 36 gunas. If you don't know it, say so and I'll cast what is firm.",
  "fields": [
    {
      "key": "tob",
      "kind": "time",
      "label": "Birth time",
      "required": true,
      "allow_unknown": true
    },
    {
      "key": "birth_time_confidence",
      "kind": "choice",
      "label": "How exact is that time?",
      "required": false,
      "allow_unknown": false,
      "options": [
        { "value": "exact", "label": "Exact \u2014 off a record or a clock" },
        { "value": "approximate", "label": "Approximate \u2014 roughly that" }
      ]
    }
  ]
};

export const birthDetailsAskPayload = {
  "type": "input_request",
  "ask": "required_slots_missing",
  "reason": "Your birth details are all I need. The time is optional \u2014 but it is what unlocks the Lagna, the twelve bhavas and 21 of the 36 gunas, so give it if you have it and say you don't if you don't.",
  "fields": [
    {
      "key": "dob",
      "kind": "date",
      "label": "Date of birth",
      "required": true,
      "allow_unknown": false
    },
    {
      "key": "tob",
      "kind": "time",
      "label": "Birth time",
      "required": true,
      "allow_unknown": true
    },
    {
      "key": "pob",
      "kind": "place",
      "label": "Birth place",
      "required": true,
      "allow_unknown": false
    }
  ]
};

export const correctionAskPayload = {
  "type": "input_request",
  "ask": "field_correction",
  "reason": "Pick the corrected value. Anything read from it \u2014 your chart, and any match it is part of \u2014 is recomputed the next time you ask for it, never quietly left as it was.",
  "fields": [
    {
      "key": "tob",
      "kind": "time",
      "label": "Birth time",
      "required": true,
      "allow_unknown": true,
      "value": "00:20"
    }
  ]
};

export const correctionPlaceAskPayload = {
  "type": "input_request",
  "ask": "field_correction",
  "reason": "Pick the corrected value. Anything read from it \u2014 your chart, and any match it is part of \u2014 is recomputed the next time you ask for it, never quietly left as it was.",
  "fields": [
    {
      "key": "pob",
      "kind": "place",
      "label": "Birth place",
      "required": true,
      "allow_unknown": false,
      "value": "Padrauna"
    }
  ]
};

export const placeChoiceAskPayload = {
  "type": "input_request",
  "ask": "place_zone_unresolved",
  "reason": "More than one place answers to that name, and they keep different clocks \u2014 which changes the Lagna. Which one is yours?",
  "fields": [
    {
      "key": "pob",
      "kind": "choice",
      "label": "Birth place",
      "required": true,
      "allow_unknown": false,
      "options": [
        { "value": "Springfield, MO, United States", "label": "Springfield, MO, United States" },
        { "value": "Springfield, MA, United States", "label": "Springfield, MA, United States" }
      ]
    }
  ]
};

/**
 * docs/49 PH-19 (ASTRAL-152/162) — the partner-priorities ask, captured on
 * 2026-08-25 from `_input_request_block("partner_priorities", Belief(),
 * "en")`. Two `multi` fields (the ranked tier and the interest tier, with
 * their cardinality) and the free-text note (AMB-32(c)).
 */
export const prioritiesAskPayload = {
  "type": "input_request",
  "ask": "partner_priorities",
  "reason": "Pick up to three, in the order they matter. They change what your match reports lead with and how your matches list is ordered — and they never change a score, a band, a verdict or a dosha flag. Skip this and everything works exactly as it does now.",
  "fields": [
    {
      "key": "priorities",
      "kind": "multi",
      "label": "What matters most to you in a partner?",
      "required": false,
      "allow_unknown": false,
      "options": [
        {
          "value": "temperament",
          "label": "Temperament and emotional fit"
        },
        {
          "value": "chemistry",
          "label": "Physical and instinctive harmony"
        },
        {
          "value": "communication",
          "label": "Mental connection and friendship"
        },
        {
          "value": "health_progeny",
          "label": "Health and children"
        },
        {
          "value": "family_life",
          "label": "Prosperity and family welfare"
        },
        {
          "value": "influence",
          "label": "Mutual influence and attraction"
        },
        {
          "value": "fortune",
          "label": "Destiny and shared fortune"
        },
        {
          "value": "values",
          "label": "Spiritual compatibility and ego balance"
        }
      ],
      "min": 0,
      "max": 3,
      "ordered": true
    },
    {
      "key": "priority_interests",
      "kind": "multi",
      "label": "Anything else that matters? (gun milan does not score these)",
      "required": false,
      "allow_unknown": false,
      "options": [
        {
          "value": "career",
          "label": "Career and work"
        },
        {
          "value": "wealth",
          "label": "Money and wealth"
        },
        {
          "value": "education",
          "label": "Education and learning"
        },
        {
          "value": "travel",
          "label": "Travel and living abroad"
        },
        {
          "value": "litigation",
          "label": "Disputes and legal matters"
        },
        {
          "value": "longevity",
          "label": "Longevity"
        }
      ],
      "min": 0,
      "max": 6,
      "ordered": false
    },
    {
      "key": "priority_note",
      "kind": "text",
      "label": "In your own words — kept as your note, not scored",
      "required": false,
      "allow_unknown": false
    }
  ]
} as const;

/**
 * docs/49 PH-19 (ASTRAL-148/149/150) — a match report with its `emphasis`
 * SIBLING, captured on 2026-08-25 from `compute_gun_milan` +
 * `priorities.emphasis_for(card, ["health_progeny", "temperament"],
 * ["career"])`.
 *
 * The point of keeping it whole: every number here is byte-identical to the
 * same report computed with no priority set, and `emphasis` sits BESIDE the
 * artifact rather than inside it. A client test that finds a different
 * `total` in a prioritised payload has found the failure this phase exists
 * to prevent.
 */
export const matchEmphasisPayload = {
  "type": "match_report",
  "groom": {
    "moon_rashi": "Taurus",
    "nakshatra": "Rohini",
    "manglik": null,
    "time_known": true,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": []
  },
  "bride": {
    "moon_rashi": "Scorpio",
    "nakshatra": "Anuradha",
    "manglik": null,
    "time_known": true,
    "moon_rashi_alternatives": [],
    "nakshatra_alternatives": []
  },
  "kootas": [
    {
      "name": "Varna",
      "points": 0.0,
      "max": 1,
      "note": "Vaishya + Brahmin",
      "meaning": "spiritual compatibility & ego balance",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Vashya",
      "points": 1.0,
      "max": 2,
      "note": "Chatushpada + Keeta",
      "meaning": "mutual influence & attraction",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Tara",
      "points": 1.5,
      "max": 3,
      "note": "birth-star counting both ways",
      "meaning": "destiny & shared fortune",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Yoni",
      "points": 2.0,
      "max": 4,
      "note": "Serpent + Deer",
      "meaning": "physical & instinctive harmony",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Graha Maitri",
      "points": 3.0,
      "max": 5,
      "note": "Venus (neutral of Mars) / Mars (neutral of Venus)",
      "meaning": "mental connection & friendship",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Gana",
      "points": 5.0,
      "max": 6,
      "note": "Manushya + Deva",
      "meaning": "temperament match",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Bhakoot",
      "points": 7.0,
      "max": 7,
      "note": "7/7 placement",
      "meaning": "prosperity & family welfare",
      "time_dependent": false,
      "pending": false,
      "provisional": false
    },
    {
      "name": "Nadi",
      "points": 8.0,
      "max": 8,
      "note": "Antya + Madhya",
      "meaning": "health & progeny",
      "time_dependent": true,
      "pending": false,
      "provisional": false
    }
  ],
  "time_known": true,
  "total": 27.5,
  "max_total": 36,
  "firm_total": 27.5,
  "firm_max": 36,
  "pending_max": 0,
  "pending_reasons": [
    "Mangal (Kuja) dosha needs Mars's house, which needs a birth time — it is not assessed here."
  ],
  "verdict": "very good",
  "doshas": [],
  "emphasis": {
    "mapping_version": 1,
    "ranked": [
      "health_progeny",
      "temperament"
    ],
    "koota_order": [
      "Nadi",
      "Gana",
      "Varna",
      "Vashya",
      "Tara",
      "Yoni",
      "Graha Maitri",
      "Bhakoot"
    ],
    "leading": [
      "Nadi",
      "Gana"
    ],
    "rule": "Ordered by Nadi, then Gana, then total.",
    "lines": [
      "You said **health and children** matters most, so this report leads with Nadi and Gana. The scores themselves are unchanged — a priority reorders what you read first, and nothing else."
    ],
    "unscored": [
      {
        "key": "career",
        "sentence": "Gun milan does not score career and work — the eight kootas read temperament, chemistry, communication and family life, and nothing else. I keep it, and I use it in readings, where the chart does carry a verdict on it."
      }
    ]
  }
} as const;

export const palmUploadAskPayload = {
  "type": "input_request",
  "ask": "palm_intent_needs_upload",
  "reason": "Both hands, if you have them: the non-dominant hand reads as what you were given, the dominant as what you've made of it. One is a real reading too — skip the other and I'll say so.",
  "fields": [
    {
      "key": "dominant_palm_file_id",
      "kind": "image",
      "label": "Your dominant hand — the one you write with",
      "required": false,
      "allow_unknown": false
    },
    {
      "key": "non_dominant_palm_file_id",
      "kind": "image",
      "label": "Your other hand — the non-dominant one",
      "required": false,
      "allow_unknown": false
    }
  ]
} as const;

export const palmHandednessAskPayload = {
  "type": "input_request",
  "ask": "handedness_for_palm",
  "reason": "\"Dominant\" names the hand's ROLE, not its side — and which side that is depends on which hand you write with. I only need this once.",
  "fields": [
    {
      "key": "handedness",
      "kind": "choice",
      "label": "Which hand do you write with?",
      "required": false,
      "allow_unknown": false,
      "options": [
        {
          "value": "right",
          "label": "Right-handed"
        },
        {
          "value": "left",
          "label": "Left-handed"
        }
      ]
    }
  ]
} as const;

export const palmTwoHandPayload = {
  "type": "palm_analysis",
  "hand": "right",
  "hand_role": "dominant",
  "hand_role_stated_by_user": true,
  "hand_stated_by_user": true,
  "hand_source": "declared",
  "thumb_side": "left",
  "fingers_direction": "up",
  "direct_answer": "",
  "hand_shape": "earth",
  "dominant_element": "Earth — a square palm with short, sturdy fingers",
  "lines": [
    {
      "name": "Heart Line",
      "description": "deep, long, curves upward toward the index finger",
      "interpretation": "warm and expressive emotionally, seeks deep connections",
      "confidence": 0.85
    },
    {
      "name": "Head Line",
      "description": "straight, clearly cut, reaching the Mount of Mercury",
      "interpretation": "practical, methodical thinking; decides before speaking",
      "confidence": 0.8
    },
    {
      "name": "Life Line",
      "description": "deep and well-formed, sweeping wide around the Mount of Venus",
      "interpretation": "a strong, well-formed Jeevan Rekha — steady vitality and physical resilience",
      "confidence": 0.78
    },
    {
      "name": "Fate Line",
      "description": "rises from the wrist, faint until mid-palm then deepening",
      "interpretation": "a career that finds its direction in the middle years rather than early",
      "confidence": 0.6
    }
  ],
  "mounts": [
    {
      "name": "Mount of Venus",
      "prominence": "prominent",
      "interpretation": "strong vitality and passion for life"
    },
    {
      "name": "Mount of Jupiter",
      "prominence": "prominent",
      "interpretation": "ambition and a natural pull toward leading"
    },
    {
      "name": "Mount of Saturn",
      "prominence": "moderate",
      "interpretation": "a measured sense of responsibility"
    },
    {
      "name": "Mount of Mercury",
      "prominence": "flat",
      "interpretation": "communication is effortful rather than instinctive"
    }
  ],
  "special_markings": [
    "triangle (Dhan Trikon) enclosed between the Head Line and the Fate Line in the centre of the palm — the classical money triangle",
    "star on Mount of Jupiter — indicates exceptional leadership",
    "island on the Head Line below Saturn — a period of divided attention"
  ],
  "predictions": {
    "lifespan_years": {
      "value": 87,
      "low": 80,
      "high": 92,
      "confidence": 0.7
    },
    "marriage_age": {
      "value": 32,
      "low": 28,
      "high": 35,
      "confidence": 0.6
    },
    "children_count": {
      "value": 2,
      "low": 1,
      "high": 3,
      "confidence": 0.55
    },
    "career_peak_age": {
      "value": 38,
      "low": 35,
      "high": 45,
      "confidence": 0.65
    },
    "wealth_peak_age": {
      "value": 47,
      "low": 42,
      "high": 55,
      "confidence": 0.6
    }
  },
  "overall_reading": "An Earth hand with a deep Life Line and a prominent Mount of Venus: steady vitality, practical judgement and a career that consolidates in the middle years rather than early.",
  "confidence_score": 0.8,
  "classical_rules": {
    "source": "Dale, Indian Palmistry (1895), Project Gutenberg #52523",
    "features": {
      "line:heart": [
        "clear",
        "long",
        "present"
      ],
      "line:head": [
        "clear",
        "present"
      ],
      "line:life": [
        "clear",
        "present"
      ],
      "line:fate": [
        "clear",
        "faint",
        "present"
      ],
      "mount:venus": [
        "prominent"
      ],
      "mount:jupiter": [
        "prominent"
      ],
      "mount:saturn": [
        "normal"
      ],
      "mount:mercury": [
        "flat"
      ],
      "mark:plain_of_mars": [
        "triangle"
      ],
      "mark:jupiter": [
        "star"
      ],
      "mark:head": [
        "island"
      ],
      "hand:shape": [
        "earth"
      ]
    },
    "fired": [
      {
        "rule_id": "mount-jupiter-prominent",
        "claim": "ambition and a drive toward leadership; honours through position",
        "domain": "career",
        "polarity": "favorable",
        "strength": "mount",
        "citation": "Dale 1895, p. 6 (Mount of Jupiter fully shown)",
        "matched": [
          "mount:jupiter=prominent"
        ]
      },
      {
        "rule_id": "mount-venus-prominent",
        "claim": "warmth, love of beauty and strong vitality",
        "domain": "marriage_family",
        "polarity": "favorable",
        "strength": "mount",
        "citation": "Dale 1895, p. 21",
        "matched": [
          "mount:venus=prominent"
        ]
      },
      {
        "rule_id": "head-clear",
        "claim": "a healthy, ordered mind; judgment that can be relied on",
        "domain": "character",
        "polarity": "favorable",
        "strength": "major_line",
        "citation": "Dale 1895, p. 78 (straight and not dissected)",
        "matched": [
          "line:head=clear"
        ]
      },
      {
        "rule_id": "head-life-triangle",
        "claim": "the great triangle formed with Life and Head — prudence, manly wit and fair fortune; the more perfect, the better the temper and courage",
        "domain": "character",
        "polarity": "favorable",
        "strength": "figure",
        "citation": "Dale 1895, p. 17 (No. 12; also p. 79)",
        "matched": [
          "line:head=clear",
          "line:life=clear",
          "mark:plain_of_mars=triangle"
        ]
      },
      {
        "rule_id": "heart-long-clear",
        "claim": "constancy — in affection and in the body's principal strength",
        "domain": "marriage_family",
        "polarity": "favorable",
        "strength": "major_line",
        "citation": "Dale 1895, p. 80 (long and without incisures)",
        "matched": [
          "line:heart=long",
          "line:heart=clear"
        ]
      },
      {
        "rule_id": "star-jupiter",
        "claim": "a star on Jupiter — splendid honours, public rewards from the great",
        "domain": "career",
        "polarity": "favorable",
        "strength": "minor_mark",
        "citation": "Dale 1895, p. 89",
        "matched": [
          "mark:jupiter=star"
        ]
      },
      {
        "rule_id": "triangle-mount",
        "claim": "the money triangle (Dhan Trikon) well closed — accumulation that holds",
        "domain": "wealth",
        "polarity": "favorable",
        "strength": "figure",
        "citation": "Dale 1895, p. 17",
        "matched": [
          "mark:plain_of_mars=triangle"
        ]
      }
    ],
    "abstained_count": 31,
    "suppressed_matches": 0
  },
  "hands": [
    {
      "hand": "right",
      "hand_role": "dominant",
      "hand_role_stated_by_user": true,
      "hand_stated_by_user": true,
      "hand_source": "declared",
      "thumb_side": "left",
      "fingers_direction": "up",
      "direct_answer": "",
      "hand_shape": "earth",
      "dominant_element": "Earth — a square palm with short, sturdy fingers",
      "lines": [
        {
          "name": "Heart Line",
          "description": "deep, long, curves upward toward the index finger",
          "interpretation": "warm and expressive emotionally, seeks deep connections",
          "confidence": 0.85
        },
        {
          "name": "Head Line",
          "description": "straight, clearly cut, reaching the Mount of Mercury",
          "interpretation": "practical, methodical thinking; decides before speaking",
          "confidence": 0.8
        },
        {
          "name": "Life Line",
          "description": "deep and well-formed, sweeping wide around the Mount of Venus",
          "interpretation": "a strong, well-formed Jeevan Rekha — steady vitality and physical resilience",
          "confidence": 0.78
        },
        {
          "name": "Fate Line",
          "description": "rises from the wrist, faint until mid-palm then deepening",
          "interpretation": "a career that finds its direction in the middle years rather than early",
          "confidence": 0.6
        }
      ],
      "mounts": [
        {
          "name": "Mount of Venus",
          "prominence": "prominent",
          "interpretation": "strong vitality and passion for life"
        },
        {
          "name": "Mount of Jupiter",
          "prominence": "prominent",
          "interpretation": "ambition and a natural pull toward leading"
        },
        {
          "name": "Mount of Saturn",
          "prominence": "moderate",
          "interpretation": "a measured sense of responsibility"
        },
        {
          "name": "Mount of Mercury",
          "prominence": "flat",
          "interpretation": "communication is effortful rather than instinctive"
        }
      ],
      "special_markings": [
        "triangle (Dhan Trikon) enclosed between the Head Line and the Fate Line in the centre of the palm — the classical money triangle",
        "star on Mount of Jupiter — indicates exceptional leadership",
        "island on the Head Line below Saturn — a period of divided attention"
      ],
      "predictions": {
        "lifespan_years": {
          "value": 87,
          "low": 80,
          "high": 92,
          "confidence": 0.7
        },
        "marriage_age": {
          "value": 32,
          "low": 28,
          "high": 35,
          "confidence": 0.6
        },
        "children_count": {
          "value": 2,
          "low": 1,
          "high": 3,
          "confidence": 0.55
        },
        "career_peak_age": {
          "value": 38,
          "low": 35,
          "high": 45,
          "confidence": 0.65
        },
        "wealth_peak_age": {
          "value": 47,
          "low": 42,
          "high": 55,
          "confidence": 0.6
        }
      },
      "overall_reading": "An Earth hand with a deep Life Line and a prominent Mount of Venus: steady vitality, practical judgement and a career that consolidates in the middle years rather than early.",
      "confidence_score": 0.8,
      "classical_rules": {
        "source": "Dale, Indian Palmistry (1895), Project Gutenberg #52523",
        "features": {
          "line:heart": [
            "clear",
            "long",
            "present"
          ],
          "line:head": [
            "clear",
            "present"
          ],
          "line:life": [
            "clear",
            "present"
          ],
          "line:fate": [
            "clear",
            "faint",
            "present"
          ],
          "mount:venus": [
            "prominent"
          ],
          "mount:jupiter": [
            "prominent"
          ],
          "mount:saturn": [
            "normal"
          ],
          "mount:mercury": [
            "flat"
          ],
          "mark:plain_of_mars": [
            "triangle"
          ],
          "mark:jupiter": [
            "star"
          ],
          "mark:head": [
            "island"
          ],
          "hand:shape": [
            "earth"
          ]
        },
        "fired": [
          {
            "rule_id": "mount-jupiter-prominent",
            "claim": "ambition and a drive toward leadership; honours through position",
            "domain": "career",
            "polarity": "favorable",
            "strength": "mount",
            "citation": "Dale 1895, p. 6 (Mount of Jupiter fully shown)",
            "matched": [
              "mount:jupiter=prominent"
            ]
          },
          {
            "rule_id": "mount-venus-prominent",
            "claim": "warmth, love of beauty and strong vitality",
            "domain": "marriage_family",
            "polarity": "favorable",
            "strength": "mount",
            "citation": "Dale 1895, p. 21",
            "matched": [
              "mount:venus=prominent"
            ]
          },
          {
            "rule_id": "head-clear",
            "claim": "a healthy, ordered mind; judgment that can be relied on",
            "domain": "character",
            "polarity": "favorable",
            "strength": "major_line",
            "citation": "Dale 1895, p. 78 (straight and not dissected)",
            "matched": [
              "line:head=clear"
            ]
          },
          {
            "rule_id": "head-life-triangle",
            "claim": "the great triangle formed with Life and Head — prudence, manly wit and fair fortune; the more perfect, the better the temper and courage",
            "domain": "character",
            "polarity": "favorable",
            "strength": "figure",
            "citation": "Dale 1895, p. 17 (No. 12; also p. 79)",
            "matched": [
              "line:head=clear",
              "line:life=clear",
              "mark:plain_of_mars=triangle"
            ]
          },
          {
            "rule_id": "heart-long-clear",
            "claim": "constancy — in affection and in the body's principal strength",
            "domain": "marriage_family",
            "polarity": "favorable",
            "strength": "major_line",
            "citation": "Dale 1895, p. 80 (long and without incisures)",
            "matched": [
              "line:heart=long",
              "line:heart=clear"
            ]
          },
          {
            "rule_id": "star-jupiter",
            "claim": "a star on Jupiter — splendid honours, public rewards from the great",
            "domain": "career",
            "polarity": "favorable",
            "strength": "minor_mark",
            "citation": "Dale 1895, p. 89",
            "matched": [
              "mark:jupiter=star"
            ]
          },
          {
            "rule_id": "triangle-mount",
            "claim": "the money triangle (Dhan Trikon) well closed — accumulation that holds",
            "domain": "wealth",
            "polarity": "favorable",
            "strength": "figure",
            "citation": "Dale 1895, p. 17",
            "matched": [
              "mark:plain_of_mars=triangle"
            ]
          }
        ],
        "abstained_count": 31,
        "suppressed_matches": 0
      }
    },
    {
      "hand": "left",
      "hand_role": "non_dominant",
      "hand_role_stated_by_user": true,
      "hand_stated_by_user": true,
      "hand_source": "declared",
      "thumb_side": "left",
      "fingers_direction": "up",
      "direct_answer": "",
      "hand_shape": "earth",
      "dominant_element": "Earth — a square palm with short, sturdy fingers",
      "lines": [
        {
          "name": "Heart Line",
          "description": "long but shallower than on the other hand",
          "interpretation": "the inherited emotional pattern is warm but less asserted",
          "confidence": 0.7
        },
        {
          "name": "Life Line",
          "description": "well-formed, slightly narrower arc",
          "interpretation": "inherited constitution is sound",
          "confidence": 0.72
        }
      ],
      "mounts": [
        {
          "name": "Mount of Venus",
          "prominence": "moderate",
          "interpretation": "the inherited warmth is present, less pronounced"
        }
      ],
      "special_markings": [
        "fish (matsya) near the wrist — classically auspicious"
      ],
      "predictions": {
        "lifespan_years": {
          "value": 87,
          "low": 80,
          "high": 92,
          "confidence": 0.7
        },
        "marriage_age": {
          "value": 32,
          "low": 28,
          "high": 35,
          "confidence": 0.6
        },
        "children_count": {
          "value": 2,
          "low": 1,
          "high": 3,
          "confidence": 0.55
        },
        "career_peak_age": {
          "value": 38,
          "low": 35,
          "high": 45,
          "confidence": 0.65
        },
        "wealth_peak_age": {
          "value": 47,
          "low": 42,
          "high": 55,
          "confidence": 0.6
        }
      },
      "overall_reading": "The inherited hand: the same Earth shape, with the warmth present but less asserted than what the dominant hand has made of it.",
      "confidence_score": 0.72,
      "classical_rules": {
        "source": "Dale, Indian Palmistry (1895), Project Gutenberg #52523",
        "features": {
          "line:heart": [
            "faint",
            "long",
            "present"
          ],
          "line:life": [
            "present"
          ],
          "mount:venus": [
            "normal"
          ],
          "mark:wrist": [
            "fish"
          ],
          "hand:shape": [
            "earth"
          ]
        },
        "fired": [
          {
            "rule_id": "fish-wrist",
            "claim": "the fish (matsya) at the root of the hand — great success in the world, riches and a full house",
            "domain": "wealth",
            "polarity": "favorable",
            "strength": "figure",
            "citation": "Dale 1895, p. 67 (No. 1)",
            "matched": [
              "mark:wrist=fish"
            ]
          }
        ],
        "abstained_count": 47,
        "suppressed_matches": 0
      }
    }
  ],
  "both_hands": true,
  "hand_label": "Dominant Hand (Right)",
  "image_file_id": "local-dev-palm-file-id",
  "image_url": "/api/v1/files/local-dev-palm-file-id/download"
} as const;
