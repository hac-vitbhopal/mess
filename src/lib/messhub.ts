import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

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
export type WeeklyMenu = Record<number, DayMenu>; 

function mk(b: string[], l: string[], s: string[], d: string[]): DayMenu {
  return { breakfast: b, lunch: l, snacks: s, dinner: d };
}

export function mkEmptyDay(): DayMenu {
  return { breakfast: [], lunch: [], snacks: [], dinner: [] };
}

/* ---------------- ⚡ Complete Hardcoded Weekly Matrix ---------------- */

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
    ["CORRIENDER ROTI", "DAL HARI MIRCH", "SEASONAL VEG.", "RAJMA MACALA", "MATAR PULAO", "FRESH SALAD", "SUJI HALWA", "POTATO WEDGES"]
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

// Fill out alternative dining centers to populate immediate UI assets instantly
const CRCL_MENU: WeeklyMenu = {
  1: mk(["IDLI SAMBHAR", "TEA"], ["VEG PULAO", "ROTI", "DAL MAKHANI"], ["PAV BHAJI", "TEA"], ["KADAI PANEER", "NAAN", "KHEER"]),
  2: mk(["POHA", "TEA"], ["CHANA MASALA", "RICE", "ROTI"], ["ALOO BONDA", "TEA"], ["MIX VEG", "DAL TADKA", "ROTI"]),
  3: mk(["DOSA", "CHUTNEY"], ["RAJMA CHAWAL", "ROTI"], ["POPIPING CORN", "TEA"], ["MALAI KOFTA", "ROTI", "SWEET"]),
  4: mk(["ALOO PARATHA", "CURD"], ["DAL FRY", "JEERA RICE", "ROTI"], ["SAMOSA", "TEA"], ["PANEER BHURJI", "CHAPATI"]),
  5: mk(["PURI SABJI", "TEA"], ["VEG KORMA", "RICE", "ROTI"], ["BISCUITS", "TEA"], ["EGG CURRY / PANEER", "ROTI"]),
  6: mk(["UTTHAPAM", "SAMBHAR"], ["KHICHDI", "PAPAD", "RAITA"], ["DRY SNACKS", "TEA"], ["CHICKEN / PANEER BUTTER MASALA", "ROTI"]),
  0: mk(["CHHOLE BHATURE", "TEA"], ["SPECIAL BIRYANI", "RAITA"], ["CAKE SLICE", "TEA"], ["SHAHI PANEER", "ROTI", "ICE CREAM"])
};

const MAYURI_BOYS_MENU: WeeklyMenu = {
  1: mk( // Monday
    ["IDLI, VADA", "SAMBHAR", "CHUTNEY", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["TAWA ROTI", "JEERA ALOO / SEV TAMATAR", "DAAL FRY", "BUTTER MILK", "MIX SALAD", "PLAIN RICE - NORTH & SOUTH", "MORE KUZHAMBU", "RAW BANANA PORIYAL", "PEPPER RASAM", "PICKLE"],
    ["KACHORI", "TAMARIND CHUTNEY", "TEA, MILK, COFFEE"],
    ["BUTTER ROTI / PLAIN ROTI", "KADHAI MIX VEG", "EGG GRAVY", "VEG PORIYAL", "PLAIN RICE - NORTH & SOUTH", "TOMATO RASAM", "YELLOW DAAL", "RICE KHEER"]
  ),
  2: mk( // Tuesday
    ["POHA, JALEBI", "PONGAL, CHUTNEY", "JEERA MAAL", "MIX CUT FRUIT", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["PURI", "WHITE CHANNA (MID-SPICY)", "MIX DAAL", "MIX SALAD", "PLAIN RICE - NORTH & SOUTH", "BOTTLE GOURD KUZHAMBU", "TOMATO RASAM", "BUTTER MILK / JUICE", "PICKLE"],
    ["VARIETY OF SAMOSA (ALOO, GOBI / MATAR)", "RED SAUCE, GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI / PLAIN ROTI", "FRUIT CUSTARD", "VEG JALFREZI / SOYA BADI MASALA", "DAL TADKA", "PLAIN RICE - NORTH & SOUTH", "PEPPER RASAM", "PICKLE"]
  ),
  3: mk( // Wednesday
    ["PAV BHAJI, UPMA", "CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI", "VEG KOFTA", "DAL TADKA", "MATAR PULAO", "FRYUMS", "SWEET BOONDI", "PLAIN RICE - SOUTH", "VEGETABLE SAMBAR", "PARUPPU RASAM", "PICKLE"],
    ["CUTLET - 2 NOS", "RED CHILI SAUCE", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI", "PANEER MASALA (LESS OIL & SPICES)", "KADAI CHICKEN MASALA (LESS OIL & SPICES)", "PLAIN DAL", "PLAIN RICE - NORTH & SOUTH", "INJI RASAM", "PICKLE", "BUTTER ROTI"]
  ),
  4: mk( // Thursday
    ["ALOO PARATHA", "DAHI", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "RAJMA", "JEERA RICE", "SEASONAL VEG", "MIXED VEG SALAD", "RICE - PLAIN", "VEG SAMBAR", "BEETROOT PORIYAL", "RASAM", "PICKLE"],
    ["NOODLES / FRIED IDLI", "SAUCE / COCONUT CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI PLAIN", "EGG GRAVY", "GREEN PEAS MASALA", "DAL FRY", "JEERA RICE", "SOOJI HALWA", "PAPPER RASAM", "PICKLE"]
  ),
  5: mk( // Friday
    ["ONION UTHAPPAM", "ONION TOMATO CHUTNEY", "SPROUTS", "FRUIT SALAD", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "KADI PAKODA", "DAL FRY", "PLAIN RICE", "MIX SALAD", "PLAIN RICE - SOUTH", "BRINJAL KUZHAMBU", "VEG AVIYAL", "BEETROOT PRIYAL", "PICKLE"],
    ["VADA PAV", "GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "TANDOORI BUTTER CHICKEN GRAVY", "KADAI PANEER", "DAL TADKA - MEDIUM SPICY", "PLAIN RICE - NORTH & SOUTH", "PULI RASAM (TAMARIND)", "PICKLE"]
  ),
  6: mk( // Saturday
    ["CHOLE WITH LEMON SLICE", "BHATURE", "MIX CUT FRUIT", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "ALOO HARA MATAR / GILKI MASALA", "GHEE RICE", "DAL MAKHNI", "PLAIN RICE - SOUTH", "POTATO KARA PORIYAL", "BUTTER MILK", "MIX VEG SAMBAR", "RASAM", "PICKLE"],
    ["BREAD PAKODA", "RED TOMATO CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "VEG PULAO", "LOBIA GRAVY (CHAWLI)", "TOOR DAL FRY", "PLAIN RICE - SOUTH", "PARUPPU RASAM", "PICKLE"]
  ),
  0: mk( // Sunday
    ["MASALA DOSA / MIX VEG DOSA", "SAMBHAR, CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "VEG BIRYANI", "BUTTER PANEER MASALA", "CHICKEN BIRYANI (LIMITED SPICES)", "ONION RAITA", "DAL KOLHAPURI", "PICKLE"],
    ["PASTA - WHITE / RED SAUCE", "SAUCE / CHUTNEY", "TEA, COFFEE, MILK"],
    ["ROTI", "ALOO WHITE PEAS MASALA", "DAL MAKHANI", "PLAIN RICE - SOUTH", "CARROT PORIYAL / CABBAGE PORIYAL", "PARUPPU RASAM (PULSES)", "VEG SORBA SOUP", "GULAB JAMUN"]
  )
};

const MAYURI_GIRLS_MENU: WeeklyMenu = JMB_MENU;
const SAFAL_MENU: WeeklyMenu = CRCL_MENU;
const AB_CATERING_MENU: WeeklyMenu = CRCL_MENU;

export const HARDCODED_WEEKLY_MENUS: Record<MessId, WeeklyMenu> = {
  jmb: JMB_MENU,
  crcl: CRCL_MENU,
  mayuri_boys: MAYURI_BOYS_MENU,
  mayuri_girls: MAYURI_GIRLS_MENU,
  safal: SAFAL_MENU,
  ab_catering: AB_CATERING_MENU,
};

export const DEFAULT_WEEKLY: WeeklyMenu = JMB_MENU;

/* ---------------- Hardcoded Memory Accessors ---------------- */

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ⚡ SPEED FIX: Instant response with 0 network latency overhead
export function getWeeklyMenu(mess: MessId): WeeklyMenu {
  return HARDCODED_WEEKLY_MENUS[mess] || DEFAULT_WEEKLY;
}

// Dummy methods maintained to avoid breaking imports across other modules
export async function saveWeeklyMenu(mess: MessId, w: WeeklyMenu) {
  console.info(`[Static Model] Data mutation blocked locally for ${mess}. Using compiled arrays.`);
}

export function getOverrides(mess: MessId): Record<string, any> {
  return {};
}

export async function saveOverrides(mess: MessId, o: any) {
  console.info("[Static Model] Overrides disabled.");
}

/* ---------------- 🔥 LIVE FIRESTORE BROADCAST ---------------- */

export async function sendBroadcast(messId: MessId, title: string, body: string) {
  if (!db) return;
  try {
    await addDoc(collection(db, "broadcasts"), {
      messId,
      title,
      body,
      createdAt: serverTimestamp(),
    });
    console.info(`[Firestore] Broadcast created successfully for ${messId}`);
  } catch (error) {
    console.error("[Firestore] Error generating broadcast entry:", error);
    throw error;
  }
}

export interface ResolvedDay {
  source: "weekly" | "special";
  label: string;
  menu: DayMenu;
}

export function resolveMenuForDate(mess: MessId, date: Date): ResolvedDay {
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

/* ---------------- Role Security & Gatekeeping ---------------- */

export const ADMIN_AUTH_KEYS: Record<string, { role: "admin" | "super-admin"; messId?: MessId }> = {
  "JMB@2026": { role: "admin", messId: "jmb" },
  "CRCL@2026": { role: "admin", messId: "crcl" },
  "MAYURIB@2026": { role: "admin", messId: "mayuri_boys" },
  "MAYURIG@2026": { role: "admin", messId: "mayuri_girls" },
  "SAFAL@2026": { role: "admin", messId: "safal" },
  "ABCAT@2026": { role: "admin", messId: "ab_catering" },
  "SUPERHUB#99": { role: "super-admin" } 
};

const ADMIN_SESSION_KEY = "messhub.admin.session";

export interface AdminSession {
  role: "admin" | "super-admin";
  messId?: MessId;
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}