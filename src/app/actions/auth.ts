"use server";

import { signIn, signOut } from "@/auth";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { redirect } from "next/navigation";

export async function loginWithGoogleAction() {
  const status = getAuthConfigStatus();
  if (!status.isConfigured) {
    redirect("/login?error=ConfigurationRequired");
  }

  await signIn("google", { redirectTo: "/dashboard" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
