import { handlers } from "@/auth";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const status = getAuthConfigStatus();
  if (!status.isConfigured) {
    return NextResponse.json(
      { error: "Authentication service is unavailable: valid configuration is required." },
      { status: 503 }
    );
  }
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const status = getAuthConfigStatus();
  if (!status.isConfigured) {
    return NextResponse.json(
      { error: "Authentication service is unavailable: valid configuration is required." },
      { status: 503 }
    );
  }
  return handlers.POST(req);
}
