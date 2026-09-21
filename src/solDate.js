// Perseverance landed Sol 0 on 2021-02-18 (UTC). A Mars sol is ~1.0274912517
// Earth days (24h 39m 35s). Both figures are well-established public mission
// facts, used here only to label the scrubber -- not for any calculation
// that needs to be exact to the second.
const LANDING_EPOCH_MS = Date.UTC(2021, 1, 18);
const SOL_LENGTH_DAYS = 1.0274912517;

export function solToEarthDate(sol) {
  return new Date(LANDING_EPOCH_MS + sol * SOL_LENGTH_DAYS * 86400000);
}

export function formatSolDate(sol) {
  return solToEarthDate(sol).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
