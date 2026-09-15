import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { 
  type DayMenuWithNutrition, 
  type NutritionDishItem, 
  type MealKey, 
  generateDishProfile 
} from "@/lib/messhub";

export interface ParsedMonthlyMenuRecord {
  [dateStr: string]: {
    [messId: string]: DayMenuWithNutrition;
  };
}

export async function parseAndUploadMenuExcel(file: File): Promise<{ datesCount: number; dishesCount: number }> {
  if (!db) throw new Error("Database not connected");

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  if (!rawRows || rawRows.length === 0) {
    throw new Error("The Excel sheet is empty or contains invalid rows.");
  }

  const structuredData: ParsedMonthlyMenuRecord = {};
  let totalDishes = 0;

  for (const row of rawRows) {
    // ⚡ Case-insensitive key retriever helper
    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
        // Check lowercase or exact match variations
        const foundKey = Object.keys(row).find(
          (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, "")
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
          return row[foundKey];
        }
      }
      return undefined;
    };

    // 1. Mandatory Fields Check
    const dateRaw = String(getVal("Date", "date") || "").trim();
    const messIdRaw = String(getVal("MessId", "messId", "Mess", "mess") || "jmb").trim().toLowerCase().replace(/\s+/g, "_");
    const mealRaw = String(getVal("Meal", "meal") || "lunch").trim().toLowerCase() as MealKey;
    const dishNameRaw = String(getVal("DishName", "dishName", "Dish", "Items", "Item") || "").trim();

    // Skip row if missing mandatory Date or DishName
    if (!dateRaw || !dishNameRaw) continue;

    // 2. Normalizing Date to YYYY-MM-DD
    let formattedDate = dateRaw;
    if (typeof row.Date === "number") {
      // Handle Excel serial date numbers
      const dateObj = new Date(Math.floor(row.Date - 25569) * 86400 * 1000);
      formattedDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
    } else if (dateRaw.includes("/")) {
      const parts = dateRaw.split("/");
      if (parts.length === 3) {
        const y = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
        formattedDate = `${y}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    if (!structuredData[formattedDate]) {
      structuredData[formattedDate] = {};
    }
    if (!structuredData[formattedDate][messIdRaw]) {
      structuredData[formattedDate][messIdRaw] = {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: [],
      };
    }

    // Split multiple dishes if listed in one cell via comma or newline
    const dishList = dishNameRaw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    dishList.forEach((singleDish) => {
      const baseProfile = generateDishProfile(singleDish, mealRaw);

      // Optional numeric parsing helper (defaults to 0 or base profile if blank)
      // Safe numeric parser that avoids undefined errors
      const parseNum = (val: any, fallback: number): number => {
        if (val === undefined || val === null || val === "" || isNaN(Number(val))) return fallback;
        return Number(val);
      };

      const dishItem: NutritionDishItem & { servingSize?: string; specialTag?: string; recipe?: { ingredients?: string; method?: string } } = {
        name: singleDish,
        servingSize: String(getVal("ServingSize", "servingSize", "Serving") || "1 Portion").trim(),
        regionalTag: String(getVal("RegionalTag", "regionalTag", "Region") || baseProfile.regionalTag || "").trim(),
        specialTag: String(getVal("SpecialTag", "specialTag") || "").trim(),
        description: String(getVal("Description", "description") || baseProfile.description || "").trim(),
        originStory: String(getVal("OriginStory", "originStory") || baseProfile.originStory || "").trim(),
        funFact: String(getVal("FunFact", "funFact") || baseProfile.funFact || "").trim(),
        
        // Primary Macros with guaranteed number fallbacks
        calories: parseNum(getVal("Calories", "calories", "Energy_kcal"), baseProfile.calories || 200),
        protein: parseNum(getVal("Protein", "protein", "Protein_g"), baseProfile.protein || 6),
        carbs: parseNum(getVal("Carbs", "carbs", "Carbs_g"), baseProfile.carbs || 25),
        fat: parseNum(getVal("Fat", "fat", "Fat_g"), baseProfile.fat || 5),
        saturatedFat: parseNum(getVal("SatFat", "saturatedFat", "SatFat_g"), baseProfile.saturatedFat || 1),
        fiber: parseNum(getVal("Fiber", "fiber", "Fiber_g"), baseProfile.fiber || 2),
        addedSugar: parseNum(getVal("Sugar", "addedSugar", "Sugar_g"), baseProfile.addedSugar || 0),

        // Kitchen Team Recipe Mapping
        recipe: {
          ingredients: String(getVal("RecipeIngredients", "recipeingredients", "Ingredients") || "").trim(),
          method: String(getVal("RecipeMethod", "recipemethod", "Method") || "").trim(),
        },

        // 12 Essential Micronutrients
        micronutrients: {
          iron: parseNum(getVal("Iron", "iron_mg"), baseProfile.micronutrients?.iron || 0),
          calcium: parseNum(getVal("Calcium", "calcium_mg"), baseProfile.micronutrients?.calcium || 0),
          magnesium: parseNum(getVal("Magnesium", "magnesium_mg"), baseProfile.micronutrients?.magnesium || 0),
          potassium: parseNum(getVal("Potassium", "potassium_mg"), baseProfile.micronutrients?.potassium || 0),
          sodium: parseNum(getVal("Sodium", "sodium_mg"), baseProfile.micronutrients?.sodium || 0),
          zinc: parseNum(getVal("Zinc", "zinc_mg"), baseProfile.micronutrients?.zinc || 0),
          vitaminA: parseNum(getVal("VitA", "vitaminA", "vita_mcg"), baseProfile.micronutrients?.vitaminA || 0),
          vitaminC: parseNum(getVal("VitC", "vitaminC", "vitc_mg"), baseProfile.micronutrients?.vitaminC || 0),
          vitaminB12: parseNum(getVal("VitB12", "vitaminB12", "vitb12_mcg"), baseProfile.micronutrients?.vitaminB12 || 0),
          folate: parseNum(getVal("Folate", "folate_mcg"), baseProfile.micronutrients?.folate || 0),
          vitaminD: parseNum(getVal("VitD", "vitaminD", "vitd_mcg"), baseProfile.micronutrients?.vitaminD || 0),
          vitaminB6: parseNum(getVal("VitB6", "vitaminB6", "vitb6_mg"), baseProfile.micronutrients?.vitaminB6 || 0),
        },
      };

      if (structuredData[formattedDate][messIdRaw][mealRaw]) {
        structuredData[formattedDate][messIdRaw][mealRaw].push(dishItem);
        totalDishes++;
      }
    });
  }

  // Batch Write to Firestore: document ID format `${messId}_${YYYY-MM-DD}`
  const batch = writeBatch(db);
  const dateKeys = Object.keys(structuredData);

  for (const date of dateKeys) {
    const messKeys = Object.keys(structuredData[date]);
    for (const messId of messKeys) {
      const docRef = doc(db, "daily_menus", `${messId}_${date}`);
      batch.set(docRef, {
        ...structuredData[date][messId],
        date,
        messId,
        updatedAt: serverTimestamp(),
        source: "excel_bulk_import",
      }, { merge: true });
    }
  }

  await batch.commit();
  return { datesCount: dateKeys.length, dishesCount: totalDishes };
}