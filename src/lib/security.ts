import { z } from "zod";
import DOMPurify from "dompurify";

const SAFE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@vitbhopal\.ac\.in$/;
const ALPHANUMERIC_SAFE = /^[a-zA-Z0-9_\-\s.]+$/;

/**
 * Strips HTML, scripts, event handlers, and SSTI syntax characters
 */
export function sanitizePlainText(rawInput: unknown): string {
  if (typeof rawInput !== "string") return "";
  const cleaned = DOMPurify.sanitize(rawInput, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned
    .replace(/[{}[\]()$%`]/g, "")
    .trim();
}

export const MessIdSchema = z.enum([
  "jmb",
  "mayuri_boys",
  "mayuri_girls",
  "safal",
  "anchor",
  "food_sutra",
  "rassense",
  "ab_catering",
]);

export const StudentProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name required")
    .max(50, "Name exceeds 50 characters")
    .regex(ALPHANUMERIC_SAFE, "Invalid characters in name")
    .transform(sanitizePlainText),
  email: z
    .string()
    .max(254, "Email exceeds 254 characters")
    .regex(SAFE_EMAIL_REGEX, "Must be a valid @vitbhopal.ac.in address")
    .toLowerCase(),
  messId: MessIdSchema,
});

export const StudentFeedbackSchema = z.object({
  name: z.string().min(1).max(50).transform(sanitizePlainText),
  email: z.string().max(254).regex(SAFE_EMAIL_REGEX),
  mess: z.string().min(1).max(60).transform(sanitizePlainText),
  message: z.string().min(1).max(5000, "Message exceeds 5,000 characters").transform(sanitizePlainText),
});

export const DishFeedbackSchema = z.object({
  studentName: z.string().min(1).max(50).transform(sanitizePlainText),
  studentEmail: z.string().max(254).regex(SAFE_EMAIL_REGEX),
  messId: MessIdSchema,
  mealKey: z.enum(["breakfast", "lunch", "snacks", "dinner"]),
  itemName: z.string().min(1).max(100).transform(sanitizePlainText),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(3000).transform(sanitizePlainText).optional().default(""),
  status: z.enum(["solved", "unsolved"]).default("unsolved"),
});

export const BroadcastSchema = z.object({
  messId: z.union([MessIdSchema, z.literal("all")]),
  title: z.string().min(1).max(100).transform(sanitizePlainText),
  body: z.string().min(1).max(10000, "Broadcast exceeds 10,000 characters").transform(sanitizePlainText),
});

// Sliding Window Rate Limiter
interface RateLimitTracker {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, RateLimitTracker>();

export function checkRateLimit(actionIdentifier: string, maxAttempts = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const record = memoryStore.get(actionIdentifier);

  if (!record || now > record.resetAt) {
    memoryStore.set(actionIdentifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count += 1;
  return true;
}