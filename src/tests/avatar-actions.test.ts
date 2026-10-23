import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { updateAvatar } from "@/app/profile/avatar-actions";
import { requireAuth } from "@/lib/auth-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { User } from "@/models/User";

vi.mock("@/lib/auth-guards", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/models/User", () => ({ User: { updateOne: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const userId = "6714e5a9c3d4f50123456789";
describe("Profile photo writes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ user: { _id: userId } } as never);
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(User.updateOne).mockResolvedValue({ acknowledged: true } as never);
  });
  it("rejects unauthenticated changes before writing", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("unauthorized"));
    expect((await updateAvatar(new FormData())).success).toBe(false);
    expect(User.updateOne).not.toHaveBeenCalled();
  });
  it("re-encodes uploads to a bounded JPEG, strips metadata and ignores a supplied target identity", async () => {
    const source = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#6654f0" } }).jpeg().withMetadata({ exif: { IFD0: { Artist: "private-camera-owner" } } }).toBuffer();
    const data = new FormData(); data.set("photo", new File([new Uint8Array(source)], "photo.jpg", { type: "image/jpeg" })); data.set("userId", "another-user");
    expect((await updateAvatar(data)).success).toBe(true);
    const [filter, update] = vi.mocked(User.updateOne).mock.calls[0];
    expect(filter).toEqual({ _id: userId });
    const saved = (update as { $set: { avatarData: Buffer; image: string } }).$set;
    expect(saved.image).toMatch(new RegExp(`^/api/avatars/${userId}\\?v=`));
    const info = await sharp(saved.avatarData).metadata();
    expect([info.width,info.height,info.format]).toEqual([256,256,"jpeg"]);
    expect(info.exif).toBeUndefined();
  });
  it("rejects mislabeled or oversized uploads", async () => {
    for (const bytes of [new TextEncoder().encode("not a real jpeg"), new Uint8Array(2*1024*1024+1)]) {
      const data = new FormData(); data.set("photo", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
      expect((await updateAvatar(data)).success).toBe(false);
    }
    expect(User.updateOne).not.toHaveBeenCalled();
  });
  it("removes only the current user's photo and remembers the explicit override", async () => {
    const data = new FormData(); data.set("action", "remove");
    expect((await updateAvatar(data)).success).toBe(true);
    expect(User.updateOne).toHaveBeenCalledWith({ _id: userId }, { $set: { image: "", avatarData: null, avatarUpdated: true } });
  });
  it("does not write when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const data = new FormData(); data.set("action", "remove");
    expect((await updateAvatar(data)).success).toBe(false); expect(User.updateOne).not.toHaveBeenCalled();
  });
});
