"use server";

import { createServerFn } from "@tanstack/react-start";

interface RegisterTokenPayload {
  token: string;
  messId: string;
}

export const registerFcmToken = createServerFn({
  method: "POST",
})
  .validator((data: RegisterTokenPayload) => data)
  .handler(async ({ data }) => {
    console.log("SERVER FUNCTION IS RUNNING");
    console.log(data);

    return {
      success: true,
    };
  });