// Staff enter dates and times in Nairobi time (UTC+3, no daylight saving), whatever timezone their
// device is set to. Used by datetime-local inputs.

const EAT_MS = 3 * 60 * 60 * 1000;

/** ISO time → "YYYY-MM-DDTHH:mm" in Nairobi time, for a datetime-local input. */
export function toNairobiInput(iso: string | null) {
  return iso ? new Date(new Date(iso).getTime() + EAT_MS).toISOString().slice(0, 16) : "";
}

/** "YYYY-MM-DDTHH:mm" in Nairobi time → ISO. */
export const fromNairobiInput = (value: string) => new Date(`${value}:00+03:00`).toISOString();

/** e.g. "Wed 4 Nov, 14:46" in Nairobi time. */
export const nairobiShort = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
