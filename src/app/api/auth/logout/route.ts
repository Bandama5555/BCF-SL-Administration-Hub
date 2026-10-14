import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  // Explicitly delete authentication cookie across all domain scopes
  response.cookies.set("bcf_token", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    sameSite: "lax",
  });

  return response;
}
