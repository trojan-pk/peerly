"use server";

import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth-guards";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { escapeRegex } from "@/lib/validations/user";
import { User } from "@/models/User";
import { StudyRequest, type RequestStatus } from "@/models/StudyRequest";

export interface PaletteResults {
  peers: Array<{ id: string; name: string; detail: string }>;
  topics: string[];
  requests: Array<{ id: string; topic: string; status: RequestStatus; tab: "incoming" | "outgoing"; other: string }>;
}

const EMPTY: PaletteResults = { peers: [], topics: [], requests: [] };
const LIMIT = 5;

/**
 * Command-palette search for the signed-in user. Returns only public peer fields
 * (no email or contact), topics from discoverable profiles, and the caller's own
 * requests. Input is length-bounded and regex-escaped; calls are rate limited.
 */
export async function searchWorkspace(rawQuery: unknown): Promise<PaletteResults> {
  if (typeof rawQuery !== "string" || !isDatabaseConfigured()) return EMPTY;
  const query = rawQuery.trim().slice(0, 60);
  if (query.length < 2) return EMPTY;

  let context;
  try {
    context = await requireAuth();
  } catch {
    return EMPTY;
  }
  try {
    const limited = await checkRateLimit(`palette:${context.user._id}`, 60, 60_000);
    if (!limited.allowed) return EMPTY;
    await connectToDatabase();
    const me = context.user._id as mongoose.Types.ObjectId;
    const pattern = new RegExp(escapeRegex(query), "i");
    const discoverable = { isProfileComplete: true, "moderation.isHidden": { $ne: true } };

    const [peers, topicRows, requests] = await Promise.all([
      User.find({ ...discoverable, _id: { $ne: me }, $or: [{ name: pattern }, { topics: pattern }, { subjects: pattern }] })
        .select("name university topics")
        .sort({ createdAt: -1, _id: -1 })
        .limit(LIMIT)
        .lean(),
      User.aggregate<{ _id: string }>([
        { $match: { ...discoverable, topics: pattern } },
        { $unwind: "$topics" },
        { $match: { topics: pattern } },
        { $group: { _id: { $toLower: "$topics" }, label: { $first: "$topics" } } },
        { $sort: { _id: 1 } },
        { $limit: LIMIT },
        { $project: { _id: "$label" } },
      ]),
      StudyRequest.find({ $or: [{ learner: me }, { peer: me }], topic: pattern, archivedBy: { $ne: me } })
        .select("topic status learner peer")
        .populate("learner", "name")
        .populate("peer", "name")
        .sort({ priority: -1, createdAt: -1, _id: -1 })
        .limit(LIMIT)
        .lean(),
    ]);

    return {
      peers: peers.map((p) => ({ id: String(p._id), name: p.name, detail: [p.university, (p.topics ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ") })),
      topics: topicRows.map((t) => t._id),
      requests: requests.map((r) => {
        const learner = r.learner as unknown as { _id: mongoose.Types.ObjectId; name?: string };
        const peer = r.peer as unknown as { _id: mongoose.Types.ObjectId; name?: string };
        const incoming = String(peer?._id) === String(me);
        return { id: String(r._id), topic: r.topic, status: r.status, tab: incoming ? "incoming" : "outgoing", other: (incoming ? learner?.name : peer?.name) || "Student" };
      }),
    };
  } catch {
    return EMPTY;
  }
}
