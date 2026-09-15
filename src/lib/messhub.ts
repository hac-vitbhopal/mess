import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
  
} from "firebase/firestore";
import { getDoc } from "firebase/firestore";
// import { serverTimestamp } from "firebase/firestore";
export type MessId = 
  | "jmb"
  | "mayuri_boys" 
  | "mayuri_girls" 
  | "rassense" 
  | "food_sutra" 
  | "safal" 
  | "anchor" 
  | "ab_catering" 
  | string;

export interface Mess {
  id: MessId;
  name: string;
  subtitle?: string;
}

export const MESSES: Mess[] = [
  { id: "jmb", name: "JMB" },
  { id: "mayuri_boys", name: "Mayuri Boys" },
  { id: "mayuri_girls", name: "Mayuri Girls" },
  { id: "rassense", name: "Rassense" },
  { id: "food_sutra", name: "Food Sutra" },
  { id: "safal", name: "Safal" },
  { id: "anchor", name: "Anchor" },
  { id: "ab_catering", name: "AB Catering" },
];

export function messLabel(id: MessId) {
  const m = MESSES.find((x) => x.id === id);
  if (!m) return id;
  return m.subtitle ? `${m.name} (${m.subtitle})` : m.name;
}

export interface StudentProfile {
  name: string;
  email?: string; // ⚡ ADDED for VIT Bhopal validation
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
      return { name: p.name, email: p.email || "", messId: p.messId };
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
  { key: "dinner",    name: "Dinner",    icon: "🌙", startH: 19, startM: 30, endH: 21, endM: 15 },
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

const CRCL_MENU: WeeklyMenu = {
  1: mk(
    ["IDLI, VADA", "SAMBHAR", "CHUTNEY", "CUT FRUIT SALAD", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["TAWA ROTI", "JEERA ALOO / SEV TAMATAR", "DHAL FRY", "SAMBHAR", "MIX SALAD", "SALAD", "Buttermilk", "MORE KUZHAMBU", "RAW BANANA PORIYAL", "PEPPER RASAM", "PICKLE"],
    ["KACHORI", "TAMIRIND CHUTNEY", "TEA, MILK, COFFEE"],
    ["BUTTER ROTI / PLAIN ROTI", "KADHAI MIX VEG", "EGG GRAVY", "MULTI GRAIN KITCHADI", "PLAIN RICE - NORTH & SOUTH", "TOMATTO RASAM", "RICE KHEER", "YELLOW DHAL"]
  ),
  2: mk(
    ["POHA JALEBI", "PONGAL CHUTENY", "JEERA MAN", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["PURI", "WHITE CHANNA [M. SPICY]", "MIX DAL", "MIX SALAD", "SOUTH INDIAN PLAIN RICE", "BOTTLE GOURD KOOTU", "GIRLIC KUZAMBU", "BUTTER MILK / JUICE", "TOMATO RASAM", "PICKLE"],
    ["VERIATY OF SAMOSA / Aallo gobi/ mutter", "RED SAUCE", "GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI / PLAIN ROTI", "FRUIT CUSTARD", "BHINDI MASALA", "DAL TADKA", "PLAIN RICE - NORTH & SOUTH", "PEPPER RASAM", "PICKLE"]
  ),
  3: mk(
    ["PAV BHAJI, UPMA", "CHUTENY", "SPROUTS", "FRUIT SALAD", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI", "VEG KOFTA [L. SWEET]", "DAL TADKA", "MUTTER PULAO", "FRYUMS", "SWEET BOONDI", "SOUTH INDIAN PLAIN RICE", "SAMBHAR", "VEG PRIYAL", "PICKLE, RASMA"],
    ["CUTLET", "RED CHILLI SAUCE", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI", "PANEER MASALA [LOW, L. SPICY]", "KADAI CHICKEN MASALA [LOW, N. SPICY]", "PLAIN DAL", "PLAIN RICE - NORTH & SOUTH", "INGI RASAM", "PICKLE", "BUTTER ROTI"]
  ),
  4: mk(
    ["ALOO PARATHA", "DAHI", "BANANA", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "RAJMA", "JEERA RICE", "SEASONAL VEG", "ONION", "MIXED VEG SALAD", "RICE - PLAIN", "VEG. SAMBAR", "BEETROOT PRIYAL", "RASAM", "PICKLE"],
    ["CHO. NOODLES / FRIED IDLI", "SAUCE / COCONUT CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI, PPLAIN", "EGG GRAVY", "GREEN PEAS MASALA", "DAL FRY", "PLAIN RICE", "SOOJ. HALWHA", "PAPER RASAM", "PICKLE"]
  ),
  5: mk(
    ["ONIO UTHAPPAM", "ONION TOMATO CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "KADI PAKODA", "DAL FRY", "PLAIN RICE", "MIX SALAD", "SOUTH INDIAN PLAIN RICE", "BRINJAL KUZHAMBU", "VEG AVIYAL", "RASAM", "PICKLE"],
    ["VADA PAV", "GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "THANDURI BUTTER CHICKEN GRAVY", "KADAI PANNER", "YELLOW DAL", "PLAIN RICE - NORTH & SOUTH", "PULI RASAM (Tamarind)", "PICKLE"]
  ),
  6: mk(
    ["CHOLE with Lemon Slice", "BHATURE", "MIX CUTFRUIT SALAD", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "CORN ALOO PALAK", "GHEE RICE", "DAL MAKHNI", "SOUTH INDIAN PLAIN RICE", "POTATO KARA PORIYAL", "BUTTER MILK", "VANDAKA SAMBAR", "RASAM", "PICKLE"],
    ["BREAD PAKODA", "RED TOMATO CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "VEG. PULAO", "LOBIAL GRAVY", "THOOR DAL TARKA", "SOUTH INDIAN PLAIN RICE", "PICKLE"]
  ),
  0: mk(
    ["MASALA DOSA/MIX VEG DOSA", "SAMBHAR, CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "VEG BIRYANI", "CHICKEN BIRYANI", "BUTTER PANEER MASALA", "DAL KOLHAPURI", "ONION CUCUMBAR RAITA", "PICKLE"],
    ["WHITE/RED SAUCE PASTA", "SAUCE/CHUTNEY", "TEA, COFFEE, MILK"],
    ["ROTI", "ALOO WHITE PEAS MASALA", "DAL MAKHANI", "SOUTH INDIAN PLAIN RICE", "BHINDI PORIYAL", "PARUPPU RASAM (PULSES)", "VEG SORBA SOUP", "GULAB JAMUN"]
  )
};

const MAYURI_BOYS_MENU: WeeklyMenu = {
  1: mk(
    ["IDLI, VADA", "SAMBHAR", "CHUTNEY", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["TAWA ROTI", "JEERA ALOO / SEV TAMATAR", "DAAL FRY", "BUTTER MILK", "MIX SALAD", "PLAIN RICE - NORTH & SOUTH", "MORE KUZHAMBU", "RAW BANANA PORIYAL", "PEPPER RASAM", "PICKLE"],
    ["KACHORI", "TAMARIND CHUTNEY", "TEA, MILK, COFFEE"],
    ["BUTTER ROTI / PLAIN ROTI", "KADHAI MIX VEG", "EGG GRAVY", "VEG PORIYAL", "PLAIN RICE - NORTH & SOUTH", "TOMATO RASAM", "YELLOW DAAL", "RICE KHEER"]
  ),
  2: mk(
    ["POHA, JALEBI", "PONGAL, CHUTNEY", "JEERA MAAL", "MIX CUT FRUIT", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["PURI", "WHITE CHANNA (MID-SPICY)", "MIX DAAL", "MIX SALAD", "PLAIN RICE - NORTH & SOUTH", "BOTTLE GOURD KUZHAMBU", "TOMATO RASAM", "BUTTER MILK / JUICE", "PICKLE"],
    ["VARIETY OF SAMOSA (ALOO, GOBI / MATAR)", "RED SAUCE, GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI / PLAIN ROTI", "FRUIT CUSTARD", "VEG JALFREZI / SOYA BADI MASALA", "DAL TADKA", "PLAIN RICE - NORTH & SOUTH", "PEPPER RASAM", "PICKLE"]
  ),
  3: mk(
    ["PAV BHAJI, UPMA", "CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI", "VEG KOFTA", "DAL TADKA", "MATAR PULAO", "FRYUMS", "SWEET BOONDI", "PLAIN RICE - SOUTH", "VEGETABLE SAMBAR", "PARUPPU RASAM", "PICKLE"],
    ["CUTLET - 2 NOS", "RED CHILI SAUCE", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI", "PANEER MASALA (LESS OIL & SPICES)", "KADAI CHICKEN MASALA (LESS OIL & SPICES)", "PLAIN DAL", "PLAIN RICE - NORTH & SOUTH", "INJI RASAM", "PICKLE", "BUTTER ROTI"]
  ),
  4: mk(
    ["ALOO PARATHA", "DAHI", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "RAJMA", "JEERA RICE", "SEASONAL VEG", "MIXED VEG SALAD", "RICE - PLAIN", "VEG SAMBAR", "BEETROOT PORIYAL", "RASAM", "PICKLE"],
    ["NOODLES / FRIED IDLI", "SAUCE / COCONUT CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI PLAIN", "EGG GRAVY", "GREEN PEAS MASALA", "DAL FRY", "JEERA RICE", "SOOJI HALWA", "PAPPER RASAM", "PICKLE"]
  ),
  5: mk(
    ["ONION UTHAPPAM", "ONION TOMATO CHUTNEY", "SPROUTS", "FRUIT SALAD", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "KADI PAKODA", "DAL FRY", "PLAIN RICE", "MIX SALAD", "PLAIN RICE - SOUTH", "BRINJAL KUZHAMBU", "VEG AVIYAL", "BEETROOT PRIYAL", "PICKLE"],
    ["VADA PAV", "GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "TANDOORI BUTTER CHICKEN GRAVY", "KADAI PANEER", "DAL TADKA - MEDIUM SPICY", "PLAIN RICE - NORTH & SOUTH", "PULI RASAM (TAMARIND)", "PICKLE"]
  ),
  6: mk(
    ["CHOLE WITH LEMON SLICE", "BHATURE", "MIX CUT FRUIT", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "ALOO HARA MATAR / GILKI MASALA", "GHEE RICE", "DAL MAKHNI", "PLAIN RICE - SOUTH", "POTATO KARA PORIYAL", "BUTTER MILK", "MIX VEG SAMBAR", "RASAM", "PICKLE"],
    ["BREAD PAKODA", "RED TOMATO CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "VEG PULAO", "LOBIA GRAVY (CHAWLI)", "TOOR DAL FRY", "PLAIN RICE - SOUTH", "PARUPPU RASAM", "PICKLE"]
  ),
  0: mk(
    ["MASALA DOSA / MIX VEG DOSA", "SAMBHAR, CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "VEG BIRYANI", "BUTTER PANEER MASALA", "CHICKEN BIRYANI (LIMITED SPICES)", "ONION RAITA", "DAL KOLHAPURI", "PICKLE"],
    ["PASTA - WHITE / RED SAUCE", "SAUCE / CHUTNEY", "TEA, COFFEE, MILK"],
    ["ROTI", "ALOO WHITE PEAS MASALA", "DAL MAKHANI", "PLAIN RICE - SOUTH", "CARROT PORIYAL / CABBAGE PORIYAL", "PARUPPU RASAM (PULSES)", "VEG SORBA SOUP", "GULAB JAMUN"]
  )
};

const MAYURI_GIRLS_MENU: WeeklyMenu = {
  1: mk(
    ["IDLI / VADA - (DEEP FRIED)", "MIX VEG-SAMBAR", "PEANUT CHUTNEY", "BANANA", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "BOILED EGG"],
    ["BUTTER, PLAIN ROTI", "TOOR DAL", "RICE - SOUTH & NORTH", "VEG - KOFTA", "SUROKAI KOOTU", "TOMATO RASAM", "CURD", "DRUMSTICK SAMBHAR", "BEETROOT CUCUMBER CARROT SALAD"],
    ["VEG - CUTLET 2 NOS", "GREEN CHUTNEY", "MILK, TEA, COFFEE"],
    ["PHULKA - ROTI", "ALOO SOYA - GRAVY", "RICE - SOUTH & NORTH", "EGG CHOP MASALA (1)", "MASALA DAL (MOONG)", "KHICHDI", "PEPPER RASAM", "PICKLE"]
  ),
  2: mk(
    ["ALOO PARATHA WITH CURD", "RAVA KHICHDI", "COCONUT CHUTNEY", "FRUITS - PAPAYA", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["CHAPATI", "CHOLE MASALA", "RICE - SOUTH & NORTH", "DAAL TADKA", "POONDU KUZHAMBU (SOUTH - LESS OIL)", "AVIYAL (SOUTH)", "RASAM", "BUTTER MILK", "PAPAD (DEEP FRIED)", "BOONDI (SWEET)"],
    ["VADA PAV", "TEA / COFEE / MILK"],
    ["CORIANDER CHAPATI", "SEV TAMATAR", "RICE - SOUTH & NORTH", "SAMBHAR", "DAL FRY", "ALOO LONG BEANS BHAJA", "SOOJI - HALWA", "PICKLE"]
  ),
  3: mk(
    ["POHA", "JALEBI", "FRUITS - MIX FRUIT", "SPROUTS", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["PLAIN ROTI", "BESAN GATTE", "LEMON RICE", "CHANA DAL", "RICE - SOUTH & NORTH", "POTATO PODIMAS", "RASAM", "FRYUMS (DEEP FRIED)", "PICKLE"],
    ["APPE", "RED CHILLI CHUTNEY", "TEA / COFEE / MILK"],
    ["ROTI - PLAIN", "DAL TADKA", "WHITE RICE", "MATAR PANEER GREVY", "BUTTER CHICKEN", "RASAM", "PICKLE"]
  ),
  4: mk(
    ["PAV BHAJI / MISSAL PAV", "RAVA UPMA", "CHUTNEY", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "BANANA"],
    ["ROTI - BUTTER, PLAIN", "KAALA CHANA (KADHAI)", "JEERA RICE", "DAL TADKA", "WHITE RICE", "CURD RICE", "KHEERA KOOTU", "RASAM, KHICHADI", "ENNAI KATRAKAI", "JEERA RASAM"],
    ["CHANA PAPDI CHAAT / PAANI PURI", "TEA / COFEE / MILK"],
    ["PLAIN ROTI", "KADHAI MIX - VEG", "GREEN MOONG - DAL", "WHITE RICE", "EGG BHURJI", "RASAM", "DALIYA", "SHAHI TUKDA"]
  ),
  5: mk(
    ["VARIETIES OF UTTAPAM", "SAMBHAR", "KARAM CHUTNEY", "SPROUTS", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["PLAIN ROTI", "RAJMA MASALA", "PLAIN RICE", "BOTTLE GOURD KOOTU / MORE KUZHAMBU", "ALOO 65", "RASAM", "TOMATO RICE", "RICE KHEER / SEVAIYA KHEER", "SALAD", "BOONDI RAITA"],
    ["MASALA SANDWICH", "SAUCE", "TEA / COFEE / MILK"],
    ["ROTI", "DAL FRY (MIX)", "PLAIN RICE", "PANEER LABABDAR / KADHAI PANEER", "VARIETIES OF CHICKEN", "LEMON RASAM", "PICKLE"]
  ),
  6: mk(
    ["BHATURA / POORI (DEEP FRIED)", "CHOLE MASALA / SABJI", "VERMASILLI KICHADI", "FRUITS - BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["PHULKA - ROTI", "KADI PAKODE", "WHITE RICE", "BAIGAN BHARTA", "RAW BANANA CHOPS", "SAMBHAR RICE", "RICE - PAPAD", "PARUPPU RASAM", "KHICHDI"],
    ["DAHI VADA (2 PCS)", "TEA / COFEE / MILK"],
    ["JEERA CHAPATI", "LAUKI CHANA DAL", "JEERA RICE", "SEV BHAJI", "RICE - SOUTH & NORTH", "RASAM", "DALIYA"]
  ),
  0: mk(
    ["DOSA (PLAIN / MASALA)", "SAMBAR", "CHUTNEY", "FRUITS", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE"],
    ["ROTI", "VEG - BIRYANI", "CHICKEN DUM BIRYANI (LIMITED SPICES)", "MASALA DAL", "ONION-CUCUMBER RAITHA", "PANEER BUTTER MASALA [SWEET]", "WHITE RICE", "RASAM", "PICKLE"],
    ["SAMOSA / DAL KACHODI", "CHUTNEY", "TEA / COFEE / MILK"],
    ["ROTI", "DAL MAKHANI", "GHUGNI", "WHITE RICE", "GULAB JAMUN (DEEP FRIED)", "KHICHADI", "RASAM", "PICKLE"]
  )
};

const SAFAL_MENU: WeeklyMenu = {
  1: mk(
    ["IDLI, VADA", "SAMBHAR", "CHUTNEY", "CUT FRUIT SALAD", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["TAWA ROTI", "JEERA ALOO / SEV TAMATAR", "DHAL FRY", "SAMBHAR", "BUTTER MILK", "MIX SALAD", "PLAIN RICE - NORTH & SOUTH", "MORE KUZHAMBU", "RAW BANANA PORIYAL", "PEPPER RASAM", "PICKLE"],
    ["KACHORI", "TAMIRIND CHUTNEY", "TEA, MILK, COFFEE"],
    ["BUTTER ROTI / PLAIN ROTI", "KADHAI MIX VEG", "EGG GRAVY", "MULTI GRAIN KITCHADI", "VEG. PORIYAL", "PLAIN RICE NORTH & SOUTH", "TOMATTO RASAM", "RICE KHEER, YELLOW DHAL"]
  ),
  2: mk(
    ["POHA JALEBI", "PONGAL CHUTENY", "JEERA MAN", "BANANA", "BREAD", "BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["PURI", "WHITE CHANNA [M. SPICY]", "MIX DAL", "MIX SALAD", "SOUTH INDIAN PLAIN RICE", "BOTTLE GOURD KUZHAMBU", "TOMATO RASAM", "BUTTER MILK / JUICE", "PICKLE"],
    ["VERIATY OF SAMOSA / Aallo gobi/ mutter", "RED SAUCE, GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI / PLAIN ROTI", "FRUIT CUSTARD", "BHINDI MASALA", "DAL TADKA", "PLAIN RICE - NORTH & SOUTH", "PEPPER RASAM", "PICKLE"]
  ),
  3: mk(
    ["PAV BHAJI, UPMA", "CHUTENY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI", "VEG KOFTA [L. SWEET]", "DAL TADKA", "MUTTER PULAO", "FRYUMS", "SWEET BOONDI", "SOUTH INDIAN PLAIN RICE", "VEGETABLE SAMBAR", "PARUPPU RASAM", "PICKLE"],
    ["CUTLET - 2 NOS.", "RED CHILLI SAUCE", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI", "PANEER MASALA [L. OIL, L. SPICY]", "KADAI CHICKEN MASALA [L. OIL, N. SPICY]", "PLAIN DAL", "PLAIN RICE - NORTH & SOUTH", "INGI RASAM", "PICKLE", "BUTTER ROTI"]
  ),
  4: mk(
    ["ALOO PARATHA", "DAHI", "BANANA", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "RAJMA", "JEERA RICE", "SEASONAL VEG", "ONION", "MIXED VEG SALAD", "RICE - PLAIN", "VEG. SAMBAR", "BEETROOT PRIYAL", "RASAM, PICKLE", "BEETROOT PRIYAL"],
    ["CHO. NOODLES / FRIED IDLI", "SAUCE / COCONUT CHUTNEY", "TEA, COFFEE, MILK"],
    ["BUTTER ROTI, PPLAIN", "EGG GRAVY", "GREEN PEAS MASALA", "DAL FRY", "JEERA RICE", "SOOJ. HALWHA", "PAPER RASAM", "PICKLE"]
  ),
  5: mk(
    ["ONIO UTHAPPAM", "ONION TOMATO CHUTNEY", "SPROUTS", "FRUIT SALAD", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "KADI PAKODA", "DAL FRY", "PLAIN RICE", "MIX SALAD", "SOUTH INDIAN PLAIN RICE", "BRINJAL KUZHAMBU", "VEG AVIYAL", "PICKLE", "BEETROOT PRIYAL"],
    ["VADA PAV", "GREEN CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "THANDURI BUTTER CHICKEN GRAVY", "KADAI PANNER", "YELLOW DAL", "PLAIN RICE - NORTH & SOUTH", "PULI RASAM (Tamarind)", "PICKLE"]
  ),
  6: mk(
    ["CHOLE with Lemon Slice", "BHATURE", "MIX CUTFRUIT SALAD", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "CORN PALAK", "GHEE RICE", "DAL MAKHNI", "SOUTH INDIAN PLAIN RICE", "POTATO KARA PORIYAL", "BUTTER MILK", "MIX VEG. SAMBAR", "RASAM", "PICKLE"],
    ["BREAD PAKODA", "RED TOMATO CHUTNEY", "TEA, COFFEE, MILK"],
    ["PLAIN ROTI", "VEG. PULAO", "LOBIAL GRAVY", "THOOR DAL FRY", "SOUTH INDIAN PLAIN RICE", "PARUPPU RASAM", "PICKLE"]
  ),
  0: mk(
    ["MASALA DOSA/MIX VEG DOSA", "SAMBHAR, CHUTNEY", "SPROUTS", "BANANA", "BOILED EGG", "BREAD, BUTTER, JAM", "TEA, MILK, COFFEE"],
    ["ROTI - PLAIN", "VEG BIRYANI", "CHICKEN BIRYANI", "BUTTER PANEER MASALA", "DAL KOLHAPURI", "ONION RAITA", "PICKLE"],
    ["WHITE/RED SAUCE PASTA", "SAUCE/CHUTNEY", "TEA, COFFEE, MILK"],
    ["ROTI", "ALOO WHITE PEAS MASALA", "DAL MAKHANI", "SOUTH INDIAN PLAIN RICE", "BHINDI PORIYAL", "PARUPPU RASAM (PULSES)", "VEG SORBA SOUP", "GULAB JAMUN"]
  )
};

const AB_CATERING_MENU: WeeklyMenu = {
  1: mk(
    ["IDLI / VADA - SEMI OIL", "MIX VEG. SAMBAR", "PEANUT CHUTNEY", "BANANA", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "BOILED EGG"],
    ["BUTTER, PLAIN ROTI", "TOOR DAL", "RICE - SOUTH, NORTH", "VEG. KOFTA", "SUROKAI KOOTU", "TOMATO RASAM", "CURD", "DRUMSTICK SAMBHAR", "BEETROOT CUCUMBER CARROT SALAD"],
    ["VEG CUTLETTS", "GREEN CHUTNEY", "MILK, TEA, COFFEE"],
    ["PHULKA", "ALOO SOYA GREVY", "RICE - S, N", "EGG CHOP MASALA (1)", "MASALA DAL (MOONG)", "KHICHDI", "PEPPER RASAM", "PICKLE"]
  ),
  2: mk(
    ["ALOO PARATHA WITH CURD", "RAVA KHICHDI, COCONUT CHUTNEY", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "FRUITS - PAPAYA"],
    ["CHAPATHI", "CHOLE MASALA", "RICE - SOUTH, NORTH", "DHAL TADKA", "POONDU KUZHAMBU (SOUTH) (Semi Oil)", "AVIYAL (SOUTH)", "RASAM", "BUTTER MILK", "PAPAD (Oil)", "BOONDI (SWEET)"],
    ["VADA PAV", "TEA / COFFEE / MILK"],
    ["CORIANDER CHAPPATHI", "SEV TAMATAR", "RICE - S, N", "SAMBHAR", "DAL FRY", "ALOO BHINDI BHAJA / ALOO BHINDI DRY", "SUJI HALWA", "PICKLE"]
  ),
  3: mk(
    ["POHA, JALEBI", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "FRUITS - MIX FRUIT", "SPROUTS"],
    ["PLAIN ROTI", "BESAN GATTA", "LEMON RICE", "CHANNA DAL", "RICE - S, N", "POTATO PODIMAS", "RASAM & PICKLE", "FRYUMS (Oil)"],
    ["APPE", "RED CHILLI CHUTNEY", "TEA / COFFEE / MILK"],
    ["ROTI - PLAIN", "DAL TADKA", "WHITE RICE", "BUTTER CHICKEN", "MATAR PANEER GREVY", "RASAM & PICKLE"]
  ),
  4: mk(
    ["PAV BHAJI / MISSAL PAV", "RAVA UPMA", "CHUTNEY", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "BANANA"],
    ["ROTI - BUTTER, PLAIN", "KAALA CHANA KADHAI", "JEERA RICE", "DAL TADKA", "WHITE RICE", "CURD RICE", "KHEERA KOOTU", "RASAM, KITCHADI", "ENNAI KATRAKAI", "JEERA RASAM"],
    ["CHANA PAPDI CHAAT / PAANI PURI", "TEA / COFFEE / MILK"],
    ["PLAIN ROTI", "MIX VEG KADHAI", "GREEN MOONG DAL", "WHITE RICE", "EGG BHURJI", "RASAM PICKLE", "DALIYA", "SHAHI TUKDA"]
  ),
  5: mk(
    ["VARIETIES OF UTTAPAM", "SAMBHAR, KARAM CHUTNEY", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "SPROUTS", "MIX FRUITS"],
    ["PLAIN ROTI", "RAJMA MASALA", "PLAIN RICE", "BOTTLE GOURD KOOTU / MOR KUZHAMBU (SOUTH)", "ALOO 65", "RASAM", "TOMATO RICE", "RICE / SEMIYA KHEER", "SALAD", "BOONDI RAITA"],
    ["MASALA SANDWICH", "SAUCE", "TEA / COFFEE / MILK"],
    ["ROTI", "DAL FRY (MIX)", "PLAIN RICE", "VARIETIES OF CHICKEN", "PANEER LABABDAR / KADHAI PANEER", "LEMON RASAM", "PICKLE"]
  ),
  6: mk(
    ["BHATURA / POORI [FRY]", "CHOLE MASALA / SABJI", "VERMICELLI UPMA / KHICHDI", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "FRUITS - BANANA", "BOILED EGG"],
    ["PHULKA", "KADI PAKODE", "WHITE RICE", "BAIGAN BHARTA", "RAW BANANA CHOPS", "SAMBHAR RICE", "RICE PAPAD", "PARUPPU RASAM", "KHICHDI"],
    ["DAHI VADA (2 PCS)", "TEA / COFFEE / MILK"],
    ["JEERA CHAPPATHI", "LAUKI CHANNA DAL", "JEERA RICE", "SEV BHAJI", "WHITE RICE - S", "RASAM & PICKLE", "DALIYA, SOUP"]
  ),
  0: mk(
    ["MASALA, PLAIN DOSA", "SAMBAR, CHUTNEY", "BREAD, BUTTER, JAM", "MILK, TEA, COFFEE", "FRUITS"],
    ["ROTI", "MASALA DAL", "CHICKEN DUM BIRYANI (LIMITED SPICE)", "VEG. BIRYANI", "ONION CUCUMBER RAITHA", "PANEER BUTTER MASALA [SWEET]", "WHITE RICE", "RASAM", "PICKLE"],
    ["SAMOSA / DAL KACHODI", "CHUTNEY", "TEA / COFFEE / MILK"],
    ["ROTI", "DAL MAKHANI", "GHUGNI", "WHITE RICE", "GULAB JAMUN [FRY]", "RASAM & PICKLE, KHICHDI"]
  )
};

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
/* ---------------- ⚡ SPECIAL FIRESTORE OVERRIDES ---------------- */

export interface SpecialOverride {
  id?: string;
  messId: MessId;
  label: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm (e.g., "07:30")
  endTime: string;    // HH:mm (e.g., "22:00")
  expiresAt: string;  // ISO Date string for automatic expiration
  menu: DayMenu;
  createdAt?: any;
}

/**
 * ⚡ Save or update a Special Override in Firestore
 */
export async function saveFirestoreOverride(messId: MessId, override: SpecialOverride) {
  if (!db) return;
  const overrideDocId = `${messId}_${override.date}`;
  await setDoc(doc(db, "mess_overrides", overrideDocId), {
    ...override,
    messId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * ⚡ Delete an override from Firestore
 */
export async function deleteFirestoreOverride(messId: MessId, dateStr: string) {
  if (!db) return;
  const overrideDocId = `${messId}_${dateStr}`;
  await deleteDoc(doc(db, "mess_overrides", overrideDocId));
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

/**
 * 🗑️ Single Broadcast Deletion Helper
 */
export async function deleteSingleBroadcast(id: string): Promise<void> {
  if (!db || !id) return;
  const firestoreDb = db; // Narrows type safely for TypeScript
  try {
    const docRef = doc(firestoreDb, "broadcasts", id);
    await deleteDoc(docRef);
    console.info(`[Firestore] Successfully deleted broadcast ID: ${id}`);
  } catch (error) {
    console.error(`[Firestore] Error deleting broadcast ${id}:`, error);
    throw error;
  }
}

/**
 * 🗑️ Bulk Broadcast Deletion Helper
 */
export async function deleteBroadcasts(ids: string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  const firestoreDb = db; // Narrows type safely for TypeScript
  try {
    const batch = writeBatch(firestoreDb);
    ids.forEach((id) => {
      const ref = doc(firestoreDb, "broadcasts", id);
      batch.delete(ref);
    });
    await batch.commit();
    console.info(`[Firestore] Successfully deleted batch of ${ids.length} broadcast(s).`);
  } catch (error) {
    console.error("[Firestore] Error performing bulk broadcast deletion:", error);
    throw error;
  }
}

/* ---------------- 📊 ANALYTICS & ONBOARDING LOGGERS ---------------- */

/**
 * 👤 Logs or updates a student profile in Firestore when they complete onboarding
 */
export async function logStudentOnboarding(profile: StudentProfile) {
  if (!db || !profile.name.trim() || !profile.messId) return;

  try {
    const normalizedName = profile.name.trim().toLowerCase().replace(/\s+/g, '_');
    const studentRef = doc(db, "registered_students", normalizedName);

    await setDoc(studentRef, {
      name: profile.name.trim(),
      email: profile.email || "", // ⚡ SAVES VIT EMAIL IN FIRESTORE
      messId: profile.messId,
      lastActiveAt: serverTimestamp(),
    }, { merge: true });

    console.info(`[Firestore] Instantly updated record for ${profile.name} -> Mess: ${profile.messId}`);
  } catch (error) {
    console.error("[Firestore] Error updating student record:", error);
  }
}

/**
 * 📊 Tracks when a user clicks on a broadcast link
 */
export async function trackBroadcastClick(broadcastId: string, broadcastTitle: string, clickedUrl: string) {
  if (!db) return;

  const profile = getProfile();
  const userName = profile?.name || "Anonymous Student";
  const userMess = profile?.messId || "unknown";

  try {
    await addDoc(collection(db, "broadcast_clicks"), {
      broadcastId,
      broadcastTitle,
      clickedUrl,
      userName,
      userMess,
      clickedAt: serverTimestamp(),
    });
    console.info(`[Analytics] Tracked click by ${userName} on ${clickedUrl}`);
  } catch (error) {
    console.error("[Analytics] Error tracking click:", error);
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

export const ADMIN_AUTH_KEYS: Record<string, { role: "admin" | "super-admin" | "nutritionist"; messId?: MessId }> = {
  [import.meta.env.VITE_ADMIN_PASS_JMB]: { role: "admin", messId: "jmb" },
  [import.meta.env.VITE_ADMIN_PASS_MAYURI_BOYS]: { role: "admin", messId: "mayuri_boys" },
  [import.meta.env.VITE_ADMIN_PASS_MAYURI_GIRLS]: { role: "admin", messId: "mayuri_girls" },
  [import.meta.env.VITE_ADMIN_PASS_RASSENSE]: { role: "admin", messId: "rassense" },
  [import.meta.env.VITE_ADMIN_PASS_FOOD_SUTRA]: { role: "admin", messId: "food_sutra" },
  [import.meta.env.VITE_ADMIN_PASS_SAFAL]: { role: "admin", messId: "safal" },
  [import.meta.env.VITE_ADMIN_PASS_ANCHOR]: { role: "admin", messId: "anchor" },
  [import.meta.env.VITE_ADMIN_PASS_AB_CATERING]: { role: "admin", messId: "ab_catering" },
  [import.meta.env.VITE_SUPER_ADMIN_PASS]: { role: "super-admin" },
  [import.meta.env.VITE_NUTRITIONIST_PASS]: { role: "nutritionist" }
};

const ADMIN_SESSION_KEY = "messhub.admin.session";
const TAB_LOCK_KEY = "messhub.active.tab.lock";
export interface AdminSession {
  role: "admin" | "super-admin" | "nutritionist";
  messId?: MessId;
  tabId?: string;
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  if (typeof window === "undefined") return;
  
  // Generate a unique identifier for this specific browser tab session
  const tabId = Math.random().toString(36).substring(2, 15);
  const secureSession = { ...session, tabId };

  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(secureSession));
  sessionStorage.setItem(TAB_LOCK_KEY, tabId);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(TAB_LOCK_KEY);
}

// Check if another mess facility or role is already active in a different tab/session
export function validateTabSessionLock(): boolean {
  if (typeof window === "undefined") return true;
  const currentSession = getAdminSession();
  if (!currentSession) return true;

  const activeTabLock = sessionStorage.getItem(TAB_LOCK_KEY);
  if (activeTabLock && activeTabLock !== currentSession.tabId) {
    return false; // Conflict detected
  }
  return true;
}

/* ---------------- 🥗 PHASE 2: NUTRITION & DYNAMIC MENUS ---------------- */

// import { getDoc } from "firebase/firestore";

// 1. Dynamic Item with Macros
// ✅ NEW: Full Macro, Micro, and Regional Profile
export interface MicronutrientProfile {
  iron?: number;        // mg
  calcium?: number;     // mg
  magnesium?: number;   // mg
  potassium?: number;   // mg
  sodium?: number;      // mg
  zinc?: number;        // mg
  vitaminA?: number;    // mcg
  vitaminC?: number;    // mg
  vitaminB12?: number;  // mcg
  folate?: number;      // mcg
  vitaminD?: number;    // mcg / IU
  vitaminB6?: number;   // mg
}

export interface NutritionDishItem {
  id?: string;
  name: string;
  regionalTag?: string; // e.g., "Tamil Nadu Style", "Punjabi", "Rajasthani", "Kerala", "Bengali"
  description?: string; // Short dish summary & health benefits
  originStory?: string; // Region of origin & cultural history
  funFact?: string;     // Popular or fun trivia about the dish

  // Primary Macro Values (Visible on Main Menu Cards)
  calories: number;     // Energy (kcal)
  protein: number;      // Protein (g)
  carbs: number;        // Carbohydrates (g)
  fat: number;          // Total Fat (g)
  saturatedFat?: number;// Saturated Fat (g)
  fiber?: number;       // Fibre (g)
  addedSugar?: number;  // Added Sugar (g)

  // Secondary Micro Breakdown (Collapsed under "Know More")
  micronutrients?: MicronutrientProfile;
}

export type MenuItemWithNutrition = NutritionDishItem;

export interface DayMenuWithNutrition {
  breakfast: NutritionDishItem[];
  lunch: NutritionDishItem[];
  snacks: NutritionDishItem[];
  dinner: NutritionDishItem[];
}

// 2. Fetch Dynamic Menu from Firestore (or fallback to empty structure)
export async function getDynamicMessMenu(messId: string, dayIndex: number): Promise<DayMenuWithNutrition | null> {
  if (!db) return null;
  try {
    const docRef = doc(db, "mess_menus", `${messId}_day_${dayIndex}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DayMenuWithNutrition;
    }
  } catch (err) {
    console.error("[MessHub] Error fetching dynamic menu:", err);
  }
  return null;
}

// 3. Save Menu & Nutrition Details from Nutritionist Admin Portal
export async function saveDynamicMessMenu(messId: MessId, dayIndex: number, menuData: DayMenuWithNutrition) {
  if (!db) return;
  const docId = `${messId}_day_${dayIndex}`;
  const session = getAdminSession(); // Grab current logged-in role
  
  try {
    await setDoc(doc(db, "mess_menus", docId), {
      ...menuData,
      updatedAt: serverTimestamp(),
      updatedByRole: session?.role || "unknown", // Tracks if 'admin' or 'nutritionist' saved it
      messId: messId,
      dayIndex: dayIndex
    }, { merge: true });
    console.info(`[Firestore] Menu saved for ${docId}`);
  } catch (error) {
    console.error("[Firestore] Error saving dynamic menu:", error);
    throw error;
  }
}

/* ---------------- ⭐ ITEM FEEDBACK SYSTEM ---------------- */

export interface ItemFeedback {
  id?: string;
  studentName: string;
  studentEmail?: string;
  messId: MessId;
  mealKey: MealKey;
  itemName: string;
  rating: number; // 1 to 5
  comment?: string;
  createdAt?: any;
}

/**
 * 📝 Submit daily item feedback to Firestore
 */
export async function submitItemFeedback(feedback: Omit<ItemFeedback, "id" | "createdAt" | "status">) {
  if (!db) return;
  try {
    await addDoc(collection(db, "item_feedback"), {
      ...feedback,
      status: "unsolved", // Default status upon submission
      createdAt: serverTimestamp(),
    });
    console.info(`[Firestore] Item feedback submitted for ${feedback.itemName}`);
  } catch (error) {
    console.error("[Firestore] Error submitting item feedback:", error);
    throw error;
  }
}

/**
 * 🚀 One-click script to seed ALL messes and days into Firestore `mess_menus`
 */
// export async function seedAllMenusToFirestore() {
//   if (!db) return;

//   const messIds = Object.keys(HARDCODED_WEEKLY_MENUS) as MessId[];
//   let totalSeeded = 0;

//   for (const messId of messIds) {
//     for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
//       const defaultMenu = HARDCODED_WEEKLY_MENUS[messId]?.[dayIndex];

//       if (defaultMenu) {
//         const menuWithNutrition: DayMenuWithNutrition = {
//           breakfast: (defaultMenu.breakfast || []).map((name) => ({
//             name,
//             calories: 220,
//             protein: 6,
//             carbs: 30,
//             fat: 5,
//           })),
//           lunch: (defaultMenu.lunch || []).map((name) => ({
//             name,
//             calories: 380,
//             protein: 12,
//             carbs: 50,
//             fat: 8,
//           })),
//           snacks: (defaultMenu.snacks || []).map((name) => ({
//             name,
//             calories: 180,
//             protein: 4,
//             carbs: 25,
//             fat: 6,
//           })),
//           dinner: (defaultMenu.dinner || []).map((name) => ({
//             name,
//             calories: 420,
//             protein: 15,
//             carbs: 55,
//             fat: 10,
//           })),
//         };

//         await saveDynamicMessMenu(messId, dayIndex, menuWithNutrition);
//         totalSeeded++;
//       }
//     }
//   }

//   console.info(`[Seeder] Successfully populated ${totalSeeded} menu documents into Firestore!`);
//   alert(`✅ Done! Created ${totalSeeded} mess menu documents across all facilities in Firestore.`);
// }
export function generateDishProfile(dishName: string, meal: MealKey): NutritionDishItem {
  const d = dishName.toLowerCase();
  
  let regionalTag = "North Indian";
  let description = "Traditional wholesome campus meal prepared with fresh ingredients.";
  let originStory = "Evolved as a staple across Indian regional home kitchens.";
  let funFact = "Prepared fresh daily using balanced spice blends for optimal digestion.";

  let calories = 220;
  let protein = 7;
  let carbs = 32;
  let fat = 6;
  let saturatedFat = 1.5;
  let fiber = 3;
  let addedSugar = 0;

  let iron = 1.8;
  let calcium = 45;
  let magnesium = 28;
  let potassium = 180;
  let sodium = 210;
  let zinc = 0.9;
  let vitaminA = 35;
  let vitaminC = 4;
  let vitaminB12 = 0.1;
  let folate = 25;
  let vitaminD = 0;
  let vitaminB6 = 0.2;

  // South Indian Dishes
  if (d.includes("dosa") || d.includes("idli") || d.includes("vada") || d.includes("uthappam") || d.includes("pongal") || d.includes("sambar") || d.includes("rasam") || d.includes("poriyal") || d.includes("kootu") || d.includes("kuzhambu") || d.includes("avial")) {
    if (d.includes("kerala") || d.includes("avial")) {
      regionalTag = "Kerala Style";
      description = "Rich vegetable medley cooked in a lightly seasoned coconut and curd sauce.";
      originStory = "Originates from the Travancore royal feast (Sadya) tradition.";
      funFact = "According to legend, Bhima invented Avial during the Pandavas' exile.";
    } else {
      regionalTag = "Tamil Nadu Style";
      description = "Authentic Southern recipe flavored with curry leaves, mustard seeds, and freshly ground spices.";
      originStory = "A century-old staple of South Indian breakfast and thali traditions.";
      funFact = "Fermented batter makes dosas and idlis naturally probiotic and gut-friendly.";
    }
    calories = d.includes("dosa") ? 260 : 190;
    protein = 7;
    carbs = 38;
    fat = 5;
    calcium = 65;
  }
  // Punjabi / North Indian Classics
  else if (d.includes("rajma") || d.includes("chole") || d.includes("paneer") || d.includes("makhani") || d.includes("bhature") || d.includes("paratha") || d.includes("butter chicken")) {
    regionalTag = "Punjabi Style";
    if (d.includes("rajma")) {
      description = "Tender kidney beans simmered in a spiced onion-tomato gravy.";
      originStory = "Popularized in the Punjab region after kidney beans arrived via trade routes.";
      funFact = "Rajma-Chawal is considered the ultimate comfort food across Northern India.";
      protein = 13;
      fiber = 7;
    } else if (d.includes("paneer")) {
      description = "Rich cottage cheese cubes cooked in aromatic spiced gravy.";
      originStory = "A festive centerpiece in North Indian culinary feasts.";
      funFact = "Paneer is one of the richest non-meat sources of complete casein protein.";
      protein = 15;
      fat = 12;
      calcium = 180;
    }
    calories = 340;
    carbs = 42;
  }
  // Rajasthani & Central Indian
  else if (d.includes("gatte") || d.includes("bati") || d.includes("churma") || d.includes("sev tamatar") || d.includes("poha") || d.includes("jalebi")) {
    if (d.includes("poha") || d.includes("jalebi")) {
      regionalTag = "Malwa / Central Indian";
      description = "Steamed flattened rice tempered with mustard, fennel seeds, and crunchy peanuts.";
      originStory = "Signature breakfast of Indore and Central India.";
      funFact = "Light, non-oily, and loaded with easily bioavailable iron from flattened paddy.";
      iron = 3.5;
    } else {
      regionalTag = "Rajasthani Style";
      description = "Gram flour dumplings or baked wheat batis infused with traditional desert spices.";
      originStory = "Developed to preserve nutritious food in arid desert climates with minimal water.";
      funFact = "Dal Baati Churma was historically carried by Rajput warriors for long expeditions.";
      protein = 10;
    }
  }
  // Bengali / Eastern
  else if (d.includes("posto") || d.includes("ghugni") || d.includes("bhaja") || d.includes("kheer")) {
    regionalTag = "Bengali Style";
    description = "Subtly spiced dish seasoned with panch phoron (five-spice blend) and mustard oil.";
    originStory = "A classic afternoon staple in Bengal households.";
  }

  return {
    name: dishName,
    regionalTag,
    description,
    originStory,
    funFact,
    calories,
    protein,
    carbs,
    fat,
    saturatedFat,
    fiber,
    addedSugar,
    micronutrients: {
      iron, calcium, magnesium, potassium, sodium, zinc,
      vitaminA, vitaminC, vitaminB12, folate, vitaminD, vitaminB6
    }
  };
}

export async function seedAllNutritionMenusToFirestore() {
  if (!db) return;

  const messIds = Object.keys(HARDCODED_WEEKLY_MENUS) as MessId[];
  let totalSeeded = 0;

  for (const messId of messIds) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const defaultMenu = HARDCODED_WEEKLY_MENUS[messId]?.[dayIndex];

      if (defaultMenu) {
        const enrichedMenu: DayMenuWithNutrition = {
          breakfast: (defaultMenu.breakfast || []).map((name) => generateDishProfile(name, "breakfast")),
          lunch: (defaultMenu.lunch || []).map((name) => generateDishProfile(name, "lunch")),
          snacks: (defaultMenu.snacks || []).map((name) => generateDishProfile(name, "snacks")),
          dinner: (defaultMenu.dinner || []).map((name) => generateDishProfile(name, "dinner")),
        };

        await setDoc(doc(db, "mess_menus", `${messId}_${dayIndex}`), {
          ...enrichedMenu,
          messId,
          day: dayIndex,
          updatedAt: serverTimestamp(),
          updatedByRole: "nutritionist",
        });

        totalSeeded++;
      }
    }
  }

  alert(`✅ Done! Populated ${totalSeeded} complete macro, micro, and regional menus across all messes into Firestore.`);
}

/* ---------------- ⭐ ITEM FEEDBACK SYSTEM ---------------- */

export interface ItemFeedback {
  id?: string;
  studentName: string;
  studentEmail?: string;
  messId: MessId;
  mealKey: MealKey;
  itemName: string;
  rating: number; // 1 to 5
  comment?: string;
  status: "solved" | "unsolved"; // ⚡ Solved/Unsolved tracker flag
  createdAt?: any;
}

/**
 * 📝 Submit daily item feedback to Firestore
 */


/**
 * ✅ Toggle Feedback Solved/Unsolved status
 */
export async function toggleFeedbackStatus(feedbackId: string, currentStatus: "solved" | "unsolved") {
  if (!db || !feedbackId) return;
  try {
    const docRef = doc(db, "item_feedback", feedbackId);
    const newStatus = currentStatus === "solved" ? "unsolved" : "solved";
    await updateDoc(docRef, { status: newStatus });
    console.info(`[Firestore] Feedback ${feedbackId} updated to ${newStatus}`);
  } catch (error) {
    console.error("[Firestore] Error updating feedback status:", error);
    throw error;
  }
}


// Add this interface if not already present
export interface KitchenRecipe {
  ingredients?: string;
  method?: string;
}

// Ensure NutritionDishItem includes servingSize, specialTag, and recipe
export interface NutritionDishItem {
  id?: string;
  name: string;
  servingSize?: string;
  regionalTag?: string;
  specialTag?: string;
  description?: string;
  originStory?: string;
  funFact?: string;
  recipe?: KitchenRecipe;

  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat?: number;
  fiber?: number;
  addedSugar?: number;

  micronutrients?: MicronutrientProfile;
}

/**
 * ⚡ Fetch Daily Date-Specific Menu (Pushed from Google Sheets or Edited in Dashboard)
 */
export async function getDailyMessMenu(messId: string, dateStr: string): Promise<DayMenuWithNutrition | null> {
  if (!db) return null;
  try {
    const docRef = doc(db, "daily_menus", `${messId}_${dateStr}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DayMenuWithNutrition;
    }
  } catch (err) {
    console.error("[MessHub] Error fetching daily menu:", err);
  }
  return null;
}

/**
 * ⚡ Save or Live-Edit Daily Menu from the Portal
 */
export async function saveDailyMessMenu(messId: string, dateStr: string, menuData: DayMenuWithNutrition) {
  if (!db) return;
  const docId = `${messId}_${dateStr}`;
  const session = getAdminSession();

  try {
    await setDoc(doc(db, "daily_menus", docId), {
      ...menuData,
      messId,
      date: dateStr,
      updatedAt: serverTimestamp(),
      updatedByRole: session?.role || "nutritionist",
    }, { merge: true });

    // Create Audit Log
    await addDoc(collection(db, "admin_audit_logs"), {
      messId,
      action: "Daily Menu Edited via Portal",
      details: `Updated daily menu for date ${dateStr}`,
      operatorRole: session?.role || "nutritionist",
      timestamp: serverTimestamp(),
    });

    console.info(`[Firestore] Saved live menu for ${docId}`);
  } catch (error) {
    console.error("[Firestore] Error saving daily menu:", error);
    throw error;
  }
}


