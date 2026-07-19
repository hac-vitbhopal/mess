"use server";

import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "@/lib/firebase-admin";

export const testAdmin = createServerFn({
  method: "GET",
}).handler(async () => {

  console.log("ADMIN LOADED");

  const collections = await adminDb.listCollections();

  return {
    collections: collections.map(c => c.id),
  };
});