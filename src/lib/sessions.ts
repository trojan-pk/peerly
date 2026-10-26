import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { connectToDatabase, ensureDatabaseIndexes } from "@/lib/db";
import { StudyRequest } from "@/models/StudyRequest";
import { User, type IUserDocument } from "@/models/User";
import { notify } from "@/lib/notifications";
import { appOrigin } from "@/lib/email";
import { buildIcs } from "@/lib/ics";
import { MAX_PROPOSED_SLOTS, MAX_SLOT_AHEAD_MS, MIN_SLOT_LEAD_MS, SESSION_DURATIONS, meetingUrl } from "@/lib/session-rules";

export type SessionResult<T = undefined> = { ok: true; value: T; message: string } | { ok: false; message: string };
const fail = (message: string): SessionResult<never> => ({ ok: false, message });

/** Statuses in which participants can coordinate a session. */
const SCHEDULABLE = ["ACCEPTED"] as const;
const MEETABLE = ["ACCEPTED", "COMPLETED", "REVIEWED"] as const;

function asId(value: unknown) {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}
const participantFilter = (me: mongoose.Types.ObjectId) => ({ $or: [{ learner: me }, { peer: me }] });

async function otherParty(requestId: mongoose.Types.ObjectId, me: mongoose.Types.ObjectId) {
  const doc = await StudyRequest.findById(requestId).select("learner peer topic").lean();
  if (!doc) return null;
  const iAmPeer = String(doc.peer) === String(me);
  return { recipientId: iAmPeer ? doc.learner : doc.peer, recipientTab: (iAmPeer ? "outgoing" : "incoming") as "incoming" | "outgoing", topic: doc.topic };
}

/**
 * Either participant of an accepted request proposes 1–3 start times. A new proposal
 * replaces the previous one and clears any agreed time, so both see the same state.
 */
export async function proposeSessionTimes(user: IUserDocument, input: { requestId?: unknown; slots?: unknown; durationMinutes?: unknown }): Promise<SessionResult<{ slots: string[] }>> {
  const requestId = asId(input.requestId);
  if (!requestId) return fail("Invalid request.");
  const raw = Array.isArray(input.slots) ? input.slots : [];
  if (raw.length < 1 || raw.length > MAX_PROPOSED_SLOTS) return fail(`Suggest between 1 and ${MAX_PROPOSED_SLOTS} times.`);
  const duration = Number(input.durationMinutes ?? 60);
  if (!(SESSION_DURATIONS as readonly number[]).includes(duration)) return fail("Choose a session length from the list.");
  const now = Date.now();
  const slots: Date[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return fail("Each time must be a valid date and time.");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fail("Each time must be a valid date and time.");
    if (date.getTime() < now + MIN_SLOT_LEAD_MS) return fail("Times must be at least 10 minutes from now.");
    if (date.getTime() > now + MAX_SLOT_AHEAD_MS) return fail("Times must be within the next 60 days.");
    slots.push(date);
  }
  const unique = [...new Map(slots.map((d) => [d.getTime(), d])).values()].sort((a, b) => a.getTime() - b.getTime());
  if (unique.length !== slots.length) return fail("Each suggested time must be different.");

  await ensureDatabaseIndexes();
  const me = user._id as mongoose.Types.ObjectId;
  const updated = await StudyRequest.findOneAndUpdate(
    { _id: requestId, ...participantFilter(me), status: { $in: SCHEDULABLE } },
    { $set: { proposedSlots: unique, proposedBy: me, sessionDurationMinutes: duration, scheduledAt: null } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return fail("Only participants of an accepted request can suggest times.");
  const other = await otherParty(requestId, me);
  if (other) await notify([{ type: "SESSION_PROPOSED", recipientId: other.recipientId, requestId, actorName: user.name, topic: other.topic, tab: other.recipientTab }]);
  return { ok: true, value: { slots: unique.map((d) => d.toISOString()) }, message: "Times sent. You'll be notified when one is picked." };
}

/**
 * The participant who did NOT propose picks one of the suggested times. The write
 * is conditional on the same proposal still being in place, so a concurrent new
 * proposal or a second pick cannot both win.
 */
export async function chooseSessionTime(user: IUserDocument, input: { requestId?: unknown; slot?: unknown }): Promise<SessionResult<{ scheduledAt: string }>> {
  const requestId = asId(input.requestId);
  if (!requestId || typeof input.slot !== "string") return fail("Invalid choice.");
  const chosen = new Date(input.slot);
  if (Number.isNaN(chosen.getTime())) return fail("Invalid choice.");
  if (chosen.getTime() < Date.now()) return fail("That time has already passed. Ask for new times.");
  await connectToDatabase();
  const me = user._id as mongoose.Types.ObjectId;
  const updated = await StudyRequest.findOneAndUpdate(
    { _id: requestId, ...participantFilter(me), status: { $in: SCHEDULABLE }, proposedBy: { $nin: [me, null] }, proposedSlots: chosen, scheduledAt: null },
    { $set: { scheduledAt: chosen, proposedSlots: [] }, $inc: { scheduleSequence: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return fail("That time is no longer available. The other person may have changed the suggestions.");
  const other = await otherParty(requestId, me);
  if (other) await notify([{ type: "SESSION_SCHEDULED", recipientId: other.recipientId, requestId, actorName: user.name, topic: other.topic, tab: other.recipientTab }]);
  return { ok: true, value: { scheduledAt: chosen.toISOString() }, message: "Session scheduled. Add it to your calendar." };
}

/** Creates (once) and returns the Jitsi room for an accepted session; participants only. */
export async function getOrCreateMeetingRoom(user: IUserDocument, rawRequestId: unknown): Promise<SessionResult<{ url: string }>> {
  const requestId = asId(rawRequestId);
  if (!requestId) return fail("Invalid request.");
  await connectToDatabase();
  const me = user._id as mongoose.Types.ObjectId;
  const scope = { _id: requestId, ...participantFilter(me), status: { $in: MEETABLE } };
  const room = `peerly-${randomBytes(16).toString("hex")}`;
  // Only the first caller sets the room; everyone then reads the same value.
  await StudyRequest.updateOne({ ...scope, meetingRoom: null }, { $set: { meetingRoom: room } });
  const doc = await StudyRequest.findOne(scope).select("+meetingRoom").lean();
  if (!doc?.meetingRoom) return fail("Meeting links are available to participants of an accepted session.");
  return { ok: true, value: { url: meetingUrl(doc.meetingRoom) }, message: "Meeting link ready." };
}

/** Builds the .ics file for a scheduled session. Returns null unless the user is a participant. */
export async function buildSessionCalendar(userId: mongoose.Types.ObjectId, rawRequestId: unknown): Promise<{ filename: string; body: string } | null> {
  const requestId = asId(rawRequestId);
  if (!requestId) return null;
  await connectToDatabase();
  const doc = await StudyRequest.findOne({ _id: requestId, ...participantFilter(userId), status: { $in: MEETABLE }, scheduledAt: { $ne: null } })
    .select("+meetingRoom topic learner peer scheduledAt sessionDurationMinutes scheduleSequence courseCode mode")
    .lean();
  if (!doc?.scheduledAt) return null;
  const people = await User.find({ _id: { $in: [doc.learner, doc.peer] } }).select("name").lean();
  const nameOf = (id: unknown) => people.find((p) => String(p._id) === String(id))?.name?.split(/\s+/)[0] ?? "Peer";
  const iAmPeer = String(doc.peer) === String(userId);
  const dashboard = `${appOrigin()}/dashboard?tab=${iAmPeer ? "incoming" : "outgoing"}#request-${String(doc._id)}`;
  const meeting = doc.meetingRoom ? meetingUrl(doc.meetingRoom) : null;
  const description = [
    `Peerly study session with ${nameOf(iAmPeer ? doc.learner : doc.peer)}.`,
    doc.courseCode ? `Course: ${doc.courseCode}` : "",
    meeting ? `Video call: ${meeting}` : doc.mode === "campus" ? "Meet in a public campus space." : "",
    `Details: ${dashboard}`,
  ].filter(Boolean).join("\n");
  const body = buildIcs({
    uid: `${String(doc._id)}@peerly`,
    sequence: doc.scheduleSequence ?? 0,
    start: new Date(doc.scheduledAt),
    durationMinutes: doc.sessionDurationMinutes ?? 60,
    summary: `Peerly: ${doc.topic}`,
    description,
    url: dashboard,
    location: meeting ?? (doc.mode === "campus" ? "Campus" : undefined),
  });
  return { filename: `peerly-session-${String(doc._id).slice(-6)}.ics`, body };
}
