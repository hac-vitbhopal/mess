"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import admin from "firebase-admin";
import { adminDb } from "./firebase-admin";
import { checkRateLimit, sanitizePlainText } from "./security";

const ComplaintSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().max(254),
  mess: z.string().min(1).max(100),
  messId: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  message: z.string().min(10).max(3000),
});

/** Keeps the Apps Script URL and shared secret out of the browser bundle. */
export const submitComplaint = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = ComplaintSchema.safeParse(data);
    if (!parsed.success) throw new Error("Invalid complaint payload.");
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!checkRateLimit(`complaint:${data.email.toLowerCase()}`, 3, 60 * 60 * 1000)) {
      throw new Error("Too many complaints submitted. Please try again later.");
    }

    const clean = {
      name: sanitizePlainText(data.name),
      email: data.email.toLowerCase().trim(),
      mess: sanitizePlainText(data.mess),
      messId: sanitizePlainText(data.messId),
      category: sanitizePlainText(data.category),
      message: sanitizePlainText(data.message),
    };

    // 1) Firestore: this is what the Admin and Super Admin dashboards read.
    const saveToFirestore = async () => {
      if (!adminDb) throw new Error("Firebase Admin is not configured on the server.");
      await adminDb.collection("complaints").add({
        studentName: clean.name,
        email: clean.email,
        mess: clean.mess,
        messId: clean.messId,
        category: clean.category,
        message: clean.message,
        status: "unsolved",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    };

    // 2) Google Sheet backup via Apps Script.
    const saveToSheet = async () => {
      const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
      const secretKey = process.env.GOOGLE_APPS_SCRIPT_SECRET;
      if (!endpoint || !secretKey) throw new Error("Complaint sheet is not configured.");
      const body = new URLSearchParams({
        secretKey,
        name: clean.name,
        email: clean.email,
        mess: clean.mess,
        messId: clean.messId,
        type: "complaint",
        rating: "-",
        message: `[Complaint - ${clean.category.toUpperCase()}] ${clean.message}`,
      });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        redirect: "follow",
      });
      const text = await response.text();
      console.log("[complaint] Apps Script replied", response.status, text.slice(0, 300));
      if (!response.ok) throw new Error(`Sheet rejected the request (HTTP ${response.status}).`);
      if (/<html|accounts\.google\.com/i.test(text)) throw new Error("Apps Script is not deployed for 'Anyone' access.");
      try {
        const json = JSON.parse(text);
        if (json && (json.success === false || json.status === "error" || json.error)) {
          throw new Error(`Apps Script error: ${json.error ?? json.message ?? "unknown"}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Apps Script error")) throw err;
      }
    };

    const [fs, sheet] = await Promise.allSettled([saveToFirestore(), saveToSheet()]);
    if (fs.status === "rejected") console.error("[complaint] Firestore save failed:", fs.reason);
    if (sheet.status === "rejected") console.error("[complaint] Sheet save failed:", sheet.reason);

    // Succeed if at least one place has the complaint; fail only if both failed.
    if (fs.status === "rejected" && sheet.status === "rejected") {
      throw new Error(fs.reason?.message ?? "Complaint could not be saved.");
    }
    return { success: true };
  });
