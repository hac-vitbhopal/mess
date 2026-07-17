export type MessId = "crcl" | "jmb" | "mayuri_boys" | "mayuri_girls" | "safal" | "ab_catering";

export interface Mess {
  id: MessId;
  name: string;
  subtitle?: string;
}

export const MESSES: Mess[] = [
  { id: "crcl", name: "CRCL" },
  { id: "jmb", name: "JMB" },
  { id: "mayuri_boys", name: "Mayuri", subtitle: "Boys" },
  { id: "mayuri_girls", name: "Mayuri", subtitle: "Girls" },
  { id: "safal", name: "Safal" },
  { id: "ab_catering", name: "AB Catering" },
];

export function messLabel(id: MessId) {
  const m = MESSES.find((x) => x.id === id)!;
  return m.subtitle ? `${m.name} (${m.subtitle})` : m.name;
}

export interface StudentProfile {
  name: string;
  messId: MessId;
}

const PROFILE_KEY = "messhub.profile";

export function getProfile(): StudentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    // migrate: strip legacy email field
    if (p && typeof p.name === "string" && typeof p.messId === "string") {
      return { name: p.name, messId: p.messId };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveProfile(p: StudentProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

/* ---------------- Meals ---------------- */

export type MealKey = "breakfast" | "lunch" | "snacks" | "dinner";

export interface MealDef {
  key: MealKey;
  name: string;
  icon: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
}

export const MEAL_DEFS: MealDef[] = [
  { key: "breakfast", name: "Breakfast", icon: "🍳", startH: 7, startM: 30, endH: 9, endM: 30 },
  { key: "lunch",     name: "Lunch",     icon: "🍽️", startH: 12, startM: 30, endH: 14, endM: 30 },
  { key: "snacks",    name: "Snacks",    icon: "☕", startH: 17, startM: 0,  endH: 18, endM: 0 },
  { key: "dinner",    name: "Dinner",    icon: "🌙", startH: 19, startM: 30, endH: 21, endM: 30 },
];

export function mealDef(key: MealKey) {
  return MEAL_DEFS.find((m) => m.key === key)!;
}

export type DayMenu = Record<MealKey, string[]>;
// weekday: 0=Sunday .. 6=Saturday (matches Date.getDay())
export type WeeklyMenu = Record<number, DayMenu>;

function mk(b: string[], l: string[], s: string[], d: string[]): DayMenu {
  return { breakfast: b, lunch: l, snacks: s, dinner: d };
}

// Default weekly template (based on typical JMB-style rotation).
export const DEFAULT_WEEKLY: WeeklyMenu = {
  1: mk( // Monday
    ["Poha", "Boiled Eggs", "Bread Butter Jam", "Milk", "Tea", "Coffee", "Banana"],
    ["Steamed Rice", "Dal Fry", "Aloo Gobi", "Chapati", "Salad", "Curd", "Pickle"],
    ["Samosa", "Green Chutney", "Masala Tea"],
    ["Jeera Rice", "Rajma", "Mixed Veg", "Chapati", "Papad", "Ice Cream"],
  ),
  2: mk( // Tuesday
    ["Upma", "Coconut Chutney", "Sprouts", "Milk", "Tea", "Coffee", "Fruit"],
    ["Veg Pulao", "Kadhi Pakoda", "Bhindi Masala", "Chapati", "Salad", "Buttermilk"],
    ["Pakora", "Tomato Ketchup", "Tea"],
    ["Chapati", "Paneer Butter Masala", "Jeera Aloo", "Dal Tadka", "Rice", "Gulab Jamun"],
  ),
  3: mk( // Wednesday
    ["Idli", "Sambar", "Coconut Chutney", "Boiled Eggs", "Milk", "Tea", "Coffee"],
    ["Rice", "Dal Makhani", "Chana Masala", "Chapati", "Salad", "Curd"],
    ["Bhel Puri", "Nimbu Pani"],
    ["Butter Roti", "Kadhi Pakoda", "Seasonal Vegetable", "Dal Fry", "Salad", "Fryums", "Pickle"],
  ),
  4: mk( // Thursday
    ["Aloo Paratha", "Curd", "Pickle", "Milk", "Tea", "Coffee", "Fruit"],
    ["Rice", "Sambhar", "Beans Poriyal", "Chapati", "Rasam", "Curd"],
    ["Vada Pav", "Mint Chutney", "Tea"],
    ["Chapati", "Chole", "Aloo Matar", "Dal", "Rice", "Halwa"],
  ),
  5: mk( // Friday
    ["Masala Dosa", "Sambar", "Coconut Chutney", "Milk", "Tea", "Coffee"],
    ["Rice", "Rajma", "Aloo Jeera", "Chapati", "Salad", "Papad"],
    ["Pav Bhaji", "Onion", "Lemon", "Tea"],
    ["Veg Biryani", "Raita", "Mirchi Ka Salan", "Chapati", "Dal", "Ice Cream"],
  ),
  6: mk( // Saturday
    ["Chole Bhature", "Onion", "Pickle", "Milk", "Tea", "Coffee"],
    ["Rice", "Dal", "Mix Veg", "Chapati", "Curd", "Salad"],
    ["Sandwich", "Ketchup", "Tea"],
    ["Fried Rice", "Manchurian", "Chapati", "Dal", "Salad", "Fruit Custard"],
  ),
  0: mk( // Sunday
    ["Puri Bhaji", "Halwa", "Boiled Eggs", "Milk", "Tea", "Coffee", "Fruit"],
    ["Veg Biryani", "Raita", "Shahi Paneer", "Chapati", "Salad", "Gulab Jamun"],
    ["Pasta", "Garlic Bread", "Tea"],
    ["Chapati", "Dum Aloo", "Dal Tadka", "Rice", "Salad", "Ice Cream"],
  ),
};

export type SpecialOverride = { label: string; menu: DayMenu };
export type Overrides = Record<string, SpecialOverride>; // key = YYYY-MM-DD

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const weeklyKey = (id: MessId) => `messhub.weekly.${id}`;
const overridesKey = (id: MessId) => `messhub.overrides.${id}`;

export function getWeeklyMenu(mess: MessId): WeeklyMenu {
  if (typeof window === "undefined") return DEFAULT_WEEKLY;
  try {
    const raw = localStorage.getItem(weeklyKey(mess));
    if (raw) return { ...DEFAULT_WEEKLY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_WEEKLY;
}

export function saveWeeklyMenu(mess: MessId, w: WeeklyMenu) {
  localStorage.setItem(weeklyKey(mess), JSON.stringify(w));
}

export function getOverrides(mess: MessId): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(overridesKey(mess));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(mess: MessId, o: Overrides) {
  localStorage.setItem(overridesKey(mess), JSON.stringify(o));
}

export interface ResolvedDay {
  source: "weekly" | "special";
  label: string;
  menu: DayMenu;
}

export function resolveMenuForDate(mess: MessId, date: Date): ResolvedDay {
  const overrides = getOverrides(mess);
  const key = dateKey(date);
  if (overrides[key]) {
    return { source: "special", label: overrides[key].label, menu: overrides[key].menu };
  }
  const weekly = getWeeklyMenu(mess);
  const wd = date.getDay();
  return {
    source: "weekly",
    label: date.toLocaleDateString(undefined, { weekday: "long" }),
    menu: weekly[wd],
  };
}

/* ---------------- Time helpers ---------------- */

export function mealStatus(m: MealDef, now: Date): "past" | "live" | "upcoming" {
  const start = new Date(now); start.setHours(m.startH, m.startM, 0, 0);
  const end = new Date(now); end.setHours(m.endH, m.endM, 0, 0);
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "live";
}

export function formatTime(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

export function currentAndNextMeal(now: Date) {
  let current: MealDef | null = null;
  let next: MealDef | null = null;
  for (const m of MEAL_DEFS) {
    const s = mealStatus(m, now);
    if (s === "live" && !current) current = m;
    if (s === "upcoming" && !next) { next = m; break; }
  }
  return { current, next };
}

export function countdownTo(h: number, m: number, now: Date) {
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target < now) target.setDate(target.getDate() + 1);
  const diff = target.getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { hours, mins, secs, total: diff };
}

export function greetingFor(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* Backwards-compat: some files may still import MEALS */
export const MEALS = MEAL_DEFS;
