import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  writeBatch, 
  serverTimestamp,
  getDoc
} from "firebase/firestore";

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
  email?: string;
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

export function mkEmptyDay(): DayMenu {
  return { breakfast: [], lunch: [], snacks: [], dinner: [] };
}

/* ---------------- ⚡ Dynamic Menu Accessors & Compatibility Stubs ---------------- */

// Preserved as exports so admin.tsx, super-admin.tsx, and StudentHome never crash on import
export const HARDCODED_WEEKLY_MENUS: Record<string, WeeklyMenu> = {};
export const DEFAULT_WEEKLY: WeeklyMenu = {
  0: mkEmptyDay(),
  1: mkEmptyDay(),
  2: mkEmptyDay(),
  3: mkEmptyDay(),
  4: mkEmptyDay(),
  5: mkEmptyDay(),
  6: mkEmptyDay(),
};

export function getWeeklyMenu(_mess: MessId): WeeklyMenu {
  return DEFAULT_WEEKLY;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function saveWeeklyMenu(mess: MessId, _w: WeeklyMenu) {
  console.info(`[Static Model] Mutation blocked locally for ${mess}.`);
}

export function getOverrides(_mess: MessId): Record<string, any> {
  return {};
}

export async function saveOverrides(_mess: MessId, _o: any) {
  console.info("[Static Model] Overrides disabled.");
}

/* ---------------- ⚡ SPECIAL FIRESTORE OVERRIDES ---------------- */

export interface SpecialOverride {
  id?: string;
  messId: MessId;
  label: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  expiresAt: string;  // ISO Date string
  menu: DayMenu;
  createdAt?: any;
}

export type Overrides = SpecialOverride;

export async function saveFirestoreOverride(messId: MessId, override: SpecialOverride) {
  if (!db) return;
  const overrideDocId = `${messId}_${override.date}`;
  await setDoc(doc(db, "mess_overrides", overrideDocId), {
    ...override,
    messId,
    updatedAt: serverTimestamp(),
  });
}

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

export async function deleteSingleBroadcast(id: string): Promise<void> {
  if (!db || !id) return;
  const firestoreDb = db;
  try {
    const docRef = doc(firestoreDb, "broadcasts", id);
    await deleteDoc(docRef);
    console.info(`[Firestore] Successfully deleted broadcast ID: ${id}`);
  } catch (error) {
    console.error(`[Firestore] Error deleting broadcast ${id}:`, error);
    throw error;
  }
}

export async function deleteBroadcasts(ids: string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  const firestoreDb = db;
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

export async function logStudentOnboarding(profile: StudentProfile) {
  if (!db || !profile.name.trim() || !profile.messId) return;

  try {
    const docKey = profile.email && profile.email.trim() !== ""
      ? profile.email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_")
      : profile.name.trim().toLowerCase().replace(/\s+/g, "_");

    const studentRef = doc(db, "registered_students", docKey);

    await setDoc(studentRef, {
      name: profile.name.trim(),
      email: profile.email ? profile.email.trim().toLowerCase() : "",
      messId: profile.messId,
      lastActiveAt: serverTimestamp(),
    }, { merge: true });

    console.info(`[Firestore] Updated record for ${profile.name} (Key: ${docKey})`);
  } catch (error) {
    console.error("[Firestore] Error updating student record:", error);
  }
}

export async function trackBroadcastClick(broadcastId: string, broadcastTitle: string, clickedUrl: string) {
  if (!db) return;

  const sanitizedUrl = (clickedUrl.startsWith("http://") || clickedUrl.startsWith("https://"))
    ? clickedUrl
    : "#";

  const profile = getProfile();
  const userName = profile?.name || "Anonymous Student";
  const userMess = profile?.messId || "unknown";

  try {
    await addDoc(collection(db, "broadcast_clicks"), {
      broadcastId,
      broadcastTitle,
      clickedUrl: sanitizedUrl,
      userName,
      userMess,
      clickedAt: serverTimestamp(),
    });
    console.info(`[Analytics] Tracked click by ${userName} on ${sanitizedUrl}`);
  } catch (error) {
    console.error("[Analytics] Error tracking click:", error);
  }
}

export interface ResolvedDay {
  source: "weekly" | "special";
  label: string;
  menu: DayMenu;
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

export function verifyAdminPasscode(passcode: string): { role: "admin" | "super-admin" | "nutritionist"; messId?: MessId } | null {
  const cleanKey = passcode.trim();
  if (!cleanKey) return null;

  const credentials: Record<string, { role: "admin" | "super-admin" | "nutritionist"; messId?: MessId }> = {
    [import.meta.env.VITE_ADMIN_PASS_JMB || ""]: { role: "admin", messId: "jmb" },
    [import.meta.env.VITE_ADMIN_PASS_MAYURI_BOYS || ""]: { role: "admin", messId: "mayuri_boys" },
    [import.meta.env.VITE_ADMIN_PASS_MAYURI_GIRLS || ""]: { role: "admin", messId: "mayuri_girls" },
    [import.meta.env.VITE_ADMIN_PASS_RASSENSE || ""]: { role: "admin", messId: "rassense" },
    [import.meta.env.VITE_ADMIN_PASS_FOOD_SUTRA || ""]: { role: "admin", messId: "food_sutra" },
    [import.meta.env.VITE_ADMIN_PASS_SAFAL || ""]: { role: "admin", messId: "safal" },
    [import.meta.env.VITE_ADMIN_PASS_ANCHOR || ""]: { role: "admin", messId: "anchor" },
    [import.meta.env.VITE_ADMIN_PASS_AB_CATERING || ""]: { role: "admin", messId: "ab_catering" },
    [import.meta.env.VITE_SUPER_ADMIN_PASS || ""]: { role: "super-admin" },
    [import.meta.env.VITE_NUTRITIONIST_PASS || ""]: { role: "nutritionist" }
  };

  delete credentials[""];
  return credentials[cleanKey] || null;
}

const ADMIN_SESSION_KEY = "messhub.admin.session";
const TAB_LOCK_KEY = "messhub.active.tab.lock";

export interface AdminSession {
  role: "admin" | "super-admin" | "nutritionist";
  messId?: MessId;
  tabId?: string;
  issuedAt?: number;
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    
    if (!session.role || (session.issuedAt && Date.now() - session.issuedAt > 28800000)) {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: Omit<AdminSession, "tabId" | "issuedAt">) {
  if (typeof window === "undefined") return;
  
  const tabId = Math.random().toString(36).substring(2, 15);
  const secureSession: AdminSession = {
    ...session,
    tabId,
    issuedAt: Date.now()
  };

  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(secureSession));
  sessionStorage.setItem(TAB_LOCK_KEY, tabId);
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(TAB_LOCK_KEY);
}

export function validateTabSessionLock(): boolean {
  if (typeof window === "undefined") return true;
  const currentSession = getAdminSession();
  if (!currentSession) return true;

  const activeTabLock = sessionStorage.getItem(TAB_LOCK_KEY);
  return !activeTabLock || activeTabLock === currentSession.tabId;
}

/* ---------------- 🥗 NUTRITION & DYNAMIC MENUS ---------------- */

export interface MicronutrientProfile {
  iron?: number;
  calcium?: number;
  magnesium?: number;
  potassium?: number;
  sodium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminB12?: number;
  folate?: number;
  vitaminD?: number;
  vitaminB6?: number;
}

export interface KitchenRecipe {
  ingredients?: string;
  method?: string;
}

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

export type MenuItemWithNutrition = NutritionDishItem;

export interface DayMenuWithNutrition {
  breakfast: NutritionDishItem[];
  lunch: NutritionDishItem[];
  snacks: NutritionDishItem[];
  dinner: NutritionDishItem[];
}

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

export async function saveDynamicMessMenu(messId: MessId, dayIndex: number, menuData: DayMenuWithNutrition) {
  if (!db) return;
  const docId = `${messId}_day_${dayIndex}`;
  const session = getAdminSession();
  const operatorRole = session?.role && ["admin", "super-admin", "nutritionist"].includes(session.role)
    ? session.role
    : "admin";
  
  try {
    await setDoc(doc(db, "mess_menus", docId), {
      ...menuData,
      updatedAt: serverTimestamp(),
      updatedByRole: operatorRole,
      messId: messId,
      dayIndex: dayIndex
    }, { merge: true });
    console.info(`[Firestore] Menu saved for ${docId}`);
  } catch (error) {
    console.error("[Firestore] Error saving dynamic menu:", error);
    throw error;
  }
}

export function generateDishProfile(dishName: string, _meal: MealKey): NutritionDishItem {
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
  } else if (d.includes("rajma") || d.includes("chole") || d.includes("paneer") || d.includes("makhani") || d.includes("bhature") || d.includes("paratha") || d.includes("butter chicken")) {
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
  } else if (d.includes("gatte") || d.includes("bati") || d.includes("churma") || d.includes("sev tamatar") || d.includes("poha") || d.includes("jalebi")) {
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
  } else if (d.includes("posto") || d.includes("ghugni") || d.includes("bhaja") || d.includes("kheer")) {
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

/* ---------------- ⭐ ITEM FEEDBACK SYSTEM ---------------- */

export interface ItemFeedback {
  id?: string;
  studentName: string;
  studentEmail?: string;
  messId: MessId;
  mealKey: MealKey;
  itemName: string;
  rating: number;
  comment?: string;
  status: "solved" | "unsolved";
  createdAt?: any;
}

export async function submitItemFeedback(feedback: Omit<ItemFeedback, "id" | "createdAt" | "status">) {
  if (!db) return;
  try {
    await addDoc(collection(db, "item_feedback"), {
      ...feedback,
      status: "unsolved",
      createdAt: serverTimestamp(),
    });
    console.info(`[Firestore] Item feedback submitted for ${feedback.itemName}`);
  } catch (error) {
    console.error("[Firestore] Error submitting item feedback:", error);
    throw error;
  }
}

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

export async function saveDailyMessMenu(messId: string, dateStr: string, menuData: DayMenuWithNutrition) {
  if (!db) return;
  const docId = `${messId}_${dateStr}`;
  const session = getAdminSession();
  const operatorRole = session?.role && ["admin", "super-admin", "nutritionist"].includes(session.role)
    ? session.role
    : "nutritionist";

  try {
    await setDoc(doc(db, "daily_menus", docId), {
      ...menuData,
      messId,
      date: dateStr,
      updatedAt: serverTimestamp(),
      updatedByRole: operatorRole,
    }, { merge: true });

    await addDoc(collection(db, "admin_audit_logs"), {
      messId,
      action: "Daily Menu Edited via Portal",
      details: `Updated daily menu for date ${dateStr}`,
      operatorRole,
      timestamp: serverTimestamp(),
    });

    console.info(`[Firestore] Saved live menu for ${docId}`);
  } catch (error) {
    console.error("[Firestore] Error saving daily menu:", error);
    throw error;
  }
}