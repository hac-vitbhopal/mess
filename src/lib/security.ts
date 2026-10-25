import { z } from "zod";

const SAFE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@vitbhopal\.ac\.in$/;

// 🔒 Unicode-aware safe text regex supporting international characters while preventing injection
const INTERNATIONAL_SAFE_TEXT = /^[\p{L}\p{N}_\-\s.]+$/u;

/**
 * Strips HTML, scripts, event handlers, and dangerous control characters.
 * Pure string logic on purpose: DOMPurify needs a browser DOM, so it breaks
 * ("sanitize is not a function") when this runs in server functions / SSR.
 */
export function sanitizePlainText(rawInput: unknown): string {
  if (typeof rawInput !== "string") return "";
  let text = rawInput;
  // Repeat until stable so nested tricks like "<scr<script>ipt>" cannot survive.
  for (let i = 0; i < 5; i += 1) {
    const next = text
      .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\/?[a-zA-Z!?][^>]*>?/g, "");
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[{}[\]()$%`]/g, "")
    .trim();
}

export const MIN_FEEDBACK_COMMENT_WORDS = 5;

/** Counts written words after stripping markup, so a rating needs a useful explanation. */
export function countFeedbackCommentWords(value: unknown): number {
  return (sanitizePlainText(value).match(/[\p{L}\p{N}]+/gu) || []).length;
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
    .regex(INTERNATIONAL_SAFE_TEXT, "Invalid characters in name")
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
  comment: z.string()
    .max(3000)
    .transform(sanitizePlainText)
    .refine(
      (comment) => countFeedbackCommentWords(comment) >= MIN_FEEDBACK_COMMENT_WORDS,
      `Please write at least ${MIN_FEEDBACK_COMMENT_WORDS} words explaining your rating.`
    ),
  status: z.enum(["solved", "unsolved"]).default("unsolved"),
});

export const BroadcastSchema = z.object({
  messId: z.union([MessIdSchema, z.literal("all")]),
  title: z.string().min(1).max(100).transform(sanitizePlainText),
  body: z.string().min(1).max(10000, "Broadcast exceeds 10,000 characters").transform(sanitizePlainText),
});

/**
 * 🔒 Distributed Rate Limiter Pattern for Serverless (Vercel)
 * Note: For absolute production security across distributed serverless functions, 
 * connect this function to Upstash Redis (`@upstash/redis`) using sliding window counters.
 */
interface RateLimitTracker {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, RateLimitTracker>();

// Periodic memory cleanup to prevent memory leaks in long-running local environments
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (now > value.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 60000);
}

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
