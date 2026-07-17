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

// Fixed time slots aligning with standard mess guidelines
export const MEAL_DEFS: MealDef[] = [
  { key: "breakfast", name: "Breakfast", icon: "🍳", startH: 7, startM: 30, endH: 9, endM: 30 },
  { key: "lunch",     name: "Lunch",     icon: "🍽️", startH: 12, startM: 15, endH: 14, endM: 15 },
  { key: "snacks",    name: "Snacks",    icon: "☕", startH: 17, startM: 15,  endH: 18, endM: 15 },
  { key: "dinner",    name: "Dinner",    icon: "🌙", startH: 19, startM: 10, endH: 20, endM: 45 },
];

export function mealDef(key: MealKey) {
  return MEAL_DEFS.find((m) => m.key === key)!;
}

export type DayMenu = Record<MealKey, string[]>;
export type WeeklyMenu = Record<number, DayMenu>; // 0 = Sunday, 1 = Monday...

function mk(b: string[], l: string[], s: string[], d: string[]): DayMenu {
  return { breakfast: b, lunch: l, snacks: s, dinner: d };
}

export function mkEmptyDay(): DayMenu {
  return { breakfast: [], lunch: [], snacks: [], dinner: [] };
}

function mkEmptyWeekly(): WeeklyMenu {
  return {
    1: mkEmptyDay(),
    2: mkEmptyDay(),
    3: mkEmptyDay(),
    4: mkEmptyDay(),
    5: mkEmptyDay(),
    6: mkEmptyDay(),
    0: mkEmptyDay()
  };
}

/* ---------------- Mess-Specific Master Registry ---------------- */

const JMB_MENU: WeeklyMenu = {
  1: mk(
    ["POHA", "Dahi Kachori", "FRUIT", "BREAD,BUTTER,JAM", "MILK,TEA, COFFEE"],
    ["BUTTER ROTI", "KADI PAKODA", "SEASONAL VEG.", "DAL FRY", "SALAD", "FRYUMS", "PICKLE"],
    ["Noodles - MEDIUM", "MILK,TEA,COFFEE"],
    ["SAHI PANEER", "PUNJABI DUM ALOO", "VEG PULAO", "DAL FRY", "TAWA ROTI", "PICKLE", "SHAHI TUKDA"]
  ),
  2: mk(
    ["Plain paratha", "Aloo sabji Gravy", "SPROUTS SALAD", "FRUIT/BANANA", "BREAD,BUTTER,JAM", "MILK, TEA, COFFEE"],
    ["Poori", "PUNJABI CHOLE", "GHEE RICE", "DAL TADKA", "PUNJABI KHADA SALAD", "FRYUMS", "KESERI KHEER", "PICKLE"],
    ["SANDWICH", "KETCHUP/CHUTNEY", "MILK,TEA, COFFEE"],
    ["METHI MATAR MALAYI", "PLAIN RICE", "DRY BHINDI MASALA/ Brinjal", "DAL YELLOW", "JEERA ROTI", "PICKLE"]
  ),
  3: mk(
    ["POORI", "ALOO Jhole Wala", "FRUIT", "BREAD,BUTTER,JAM", "MILK,TEA, COFFEE"],
    ["TAWA ROTI", "JEERA AALOO", "HARI MIRCH DAL TADKA", "STEAM RICE", "FRESH SALAD WITH ONION", "KHAJOOR KI LAUNJI", "TADKE WALA DAHI"],
    ["SAMOSA", "MINT CHUTNEY", "MILK,TEA, COFFEE"],
    ["CORRIENDER ROTI", "DAL HARI MIRCH", "SEASONAL VEG.", "RAJMA MASALA", "MATAR PULAO", "FRESH SALAD", "SUJI HALWA", "POTATO WEDGES"]
  ),
  4: mk(
    ["VARIETY UTHAPPAM", "SAMBHAR", "CHUTNEY", "FRUIT", "BREAD,BUTTER,JAM", "MILK,TEA, COFFEE"],
    ["TADKE WALI CHACH", "GATTE KI SABJI", "VEG. PULAO", "Navratan DAL", "WHITE RICE", "SADA BATI", "CHURMA", "CHUTNEY", "PAPAD CHURI"],
    ["VADA PAO", "FRIED GREEN CHILLI / Green Chutney", "MILK,TEA, COFFEE"],
    ["TAWA ROTI", "DAHI AALOO TIKKI FRIED", "JEERA RICE", "DAL TADKA", "PICKLE", "FRESH SALAD", "MUTTER PANEER"]
  ),
  5: mk(
    ["Masala DOSA", "SAMBHAR", "ASSORTED CHUTNEY", "FRUIT", "BREAD,BUTTER,JAM", "MILK,TEA, COFFEE"],
    ["ROTI", "ALOO MATAR MASALA", "CHOLE MASALA", "VEG PULAO", "FRY DAL", "JUICE/buttermilk", "PICKLE", "FRESH SALAD"],
    ["VEG CUTLET", "CHUTNEY", "MILK,TEA,COFFEE"],
    ["SEASONAL VEG", "ALOO SOYA MASALA", "PLAIN RICE", "DAL Makhani", "TAWA ROTI", "PICKLE"]
  ),
  6: mk(
    ["CHOLE BHATURE", "LEMON PIECES", "FRUIT/BANANA", "BREAD,BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["TAWA ROTI", "MIX VEG.", "RAJMA MASALA", "JEERA RICE", "HARI MIRCH DAL TADKA", "BOONDI RAITA", "PICKLE", "FRYUMS"],
    ["BHEL PURI", "MILK,TEA,COFFEE"],
    ["SEV TAMATAR GRAVY", "BESAN", "KUSKA RICE", "DAL TADKA", "METHI CHAPATHI", "PICKLE"]
  ),
  0: mk(
    ["IDLI", "VADA", "SAMBHAR", "ASSORTED CHUTNEY", "FRUIT", "BREAD,BUTTER,JAM", "MILK,TEA, COFFEE"],
    ["ROTI", "CHAWLI GRAVY", "VEG BIRYANI", "SALAD", "ONION RAITA", "PICKLE", "VEG JALFREZI"],
    ["Variety Sauce PASTA", "MILK,TEA,COFFEE"],
    ["TAWA ROTI", "KADHAI PANEER", "SEASONAL VEG.", "DAL TADKA", "JEERA RICE", "FRESH SALAD WITH ONION", "PICKLE", "PINEAPPLE SEERA"]
  )
};

const MAYURI_BOYS_MENU: WeeklyMenu = mkEmptyWeekly();
const MAYURI_GIRLS_MENU: WeeklyMenu = mkEmptyWeekly();
const CRCL_MENU: WeeklyMenu = mkEmptyWeekly();
const SAFAL_MENU: WeeklyMenu = mkEmptyWeekly();
const AB_CATERING_MENU: WeeklyMenu = mkEmptyWeekly();

export const MESS_MENUS_REGISTRY: Record<MessId, WeeklyMenu> = {
  jmb: JMB_MENU,
  mayuri_boys: MAYURI_BOYS_MENU,
  mayuri_girls: MAYURI_GIRLS_MENU,
  crcl: CRCL_MENU,
  safal: SAFAL_MENU,
  ab_catering: AB_CATERING_MENU,
};

// Global default configuration fallback mapping
export const DEFAULT_WEEKLY: WeeklyMenu = JMB_MENU;

/* ---------------- Data Sync Mechanics ---------------- */

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
  const fallbackMenu = MESS_MENUS_REGISTRY[mess] || mkEmptyWeekly();
  if (typeof window === "undefined") return fallbackMenu;
  try {
    const raw = localStorage.getItem(weeklyKey(mess));
    return raw ? { ...fallbackMenu, ...JSON.parse(raw) } : fallbackMenu;
  } catch {}
  return fallbackMenu;
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
  const activeDayMenu = weekly[wd] || mkEmptyDay();
  
  return {
    source: "weekly",
    label: date.toLocaleDateString(undefined, { weekday: "long" }),
    menu: activeDayMenu,
  };
}

/* ---------------- Time Helpers ---------------- */

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

export const MEALS = MEAL_DEFS;