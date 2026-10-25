"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secretKey = process.env.GOOGLE_APPS_SCRIPT_SECRET;
    if (!endpoint || !secretKey) throw new Error("Complaint service is not configured.");

    if (!checkRateLimit(`complaint:${data.email.toLowerCase()}`, 3, 60 * 60 * 1000)) {
      throw new Error("Too many complaints submitted. Please try again later.");
    }

    const body = new URLSearchParams({
      secretKey,
      name: sanitizePlainText(data.name),
      email: data.email.toLowerCase().trim(),
      mess: sanitizePlainText(data.mess),
      messId: sanitizePlainText(data.messId),
      type: "complaint",
      rating: "-",
      message: `[Complaint - ${sanitizePlainText(data.category).toUpperCase()}] ${sanitizePlainText(data.message)}`,
    });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) throw new Error("Complaint service could not accept this request.");
    return { success: true };
  });
