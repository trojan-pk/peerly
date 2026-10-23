"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { User } from "@/models/User";

export async function updateAvatar(data: FormData): Promise<{ success: boolean; message: string }> {
  let context;
  try { context = await requireAuth(); }
  catch { return { success: false, message: "Sign in to change your photo." }; }
  try {
    const limit = await checkRateLimit(`avatar:${context.user._id}`, 6, 60000);
    if (!limit.allowed) return { success: false, message: "Please wait a minute before changing your photo again." };
    if (data.get("action") === "remove") {
      await User.updateOne({ _id: context.user._id }, { $set: { image: "", avatarData: null, avatarUpdated: true } });
    } else {
      const file = data.get("photo");
      if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) {
        return { success: false, message: "Choose a JPG, PNG or WebP photo up to 2 MB." };
      }
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) {
        return { success: false, message: "Use a still JPG, PNG or WebP image." };
      }
      const avatarData = await image.rotate().resize(256, 256, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
      await User.updateOne({ _id: context.user._id }, { $set: { avatarData, avatarUpdated: true, image: `/api/avatars/${context.user._id}?v=${Date.now()}` } });
    }
    try { revalidatePath("/", "layout"); } catch { /* outside a Next request */ }
    return { success: true, message: data.get("action") === "remove" ? "Profile photo removed." : "Profile photo updated." };
  } catch {
    return { success: false, message: "We couldn’t save that photo. Try a smaller JPG or PNG image." };
  }
}
