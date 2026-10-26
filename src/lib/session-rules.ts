/** Session scheduling rules shared by server validation and client UI (no DB imports). */
export const MAX_PROPOSED_SLOTS = 3;
export const SESSION_DURATIONS = [30, 45, 60, 90, 120] as const;
export const MIN_SLOT_LEAD_MS = 10 * 60 * 1000;
export const MAX_SLOT_AHEAD_MS = 60 * 24 * 60 * 60 * 1000;

/** Jitsi rooms on the public meet.jit.si service. 128-bit random name, hex encoded. */
export const JITSI_BASE = "https://meet.jit.si/";
export function meetingUrl(room: string): string {
  return `${JITSI_BASE}${room}`;
}
export const MEETING_ROOM_PATTERN = /^peerly-[a-f0-9]{32}$/;
