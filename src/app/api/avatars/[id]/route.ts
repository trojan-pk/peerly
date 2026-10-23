import mongoose from "mongoose";
import { getCurrentDbUser } from "@/lib/auth-guards";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentDbUser();
  if (!context) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return new Response(null, { status: 404 });
  try {
    await connectToDatabase();
    const user = await User.findById(id).select("+avatarData");
    if (!user?.avatarData || (user.moderation?.isHidden && id !== context.user._id.toString())) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(user.avatarData), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 503 }); }
}
