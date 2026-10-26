"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarPlus, Clock, Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { chooseSessionTimeAction, getMeetingLinkAction, proposeSessionTimesAction } from "@/app/actions/sessions";
import { MAX_PROPOSED_SLOTS, MIN_SLOT_LEAD_MS, SESSION_DURATIONS } from "@/lib/session-rules";
import type { StudyRequestDTO } from "@/lib/study-requests";

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const format = (iso: string) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Propose/choose a session time, add it to a calendar and open a video call. */
export function SessionPlanner({ req, otherName }: { req: StudyRequestDTO; otherName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState<string[]>([""]);
  const [duration, setDuration] = useState<number>(req.session.durationMinutes || 60);
  const { session } = req;
  const accepted = req.status === "ACCEPTED";
  const first = otherName.split(/\s+/)[0];

  function act<T>(work: () => Promise<{ success: boolean; message?: string; data?: T }>, after?: (data?: T) => void) {
    startTransition(async () => {
      let result: { success: boolean; message?: string; data?: T };
      try { result = await work(); } catch { result = { success: false, message: "We couldn't reach the server. Please try again." }; }
      toast.show({ tone: result.success ? "success" : "error", title: result.message ?? (result.success ? "Done." : "Something went wrong.") });
      if (result.success) { after?.(result.data); router.refresh(); }
    });
  }

  function propose() {
    const iso = slots.filter(Boolean).map((v) => new Date(v).toISOString());
    act(() => proposeSessionTimesAction({ requestId: req.id, slots: iso, durationMinutes: duration }), () => { setEditing(false); setSlots([""]); });
  }

  function openMeeting() {
    act<{ url: string }>(() => getMeetingLinkAction(req.id), (data) => { if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer"); });
  }

  const [min, setMin] = useState<string | undefined>(undefined);

  return (
    <section className="session-planner" aria-label="Session time and video call">
      {session.scheduledAt ? (
        <div className="session-row">
          <CalendarCheck size={18} className="text-success shrink-0" aria-hidden="true" />
          <p><strong>Scheduled:</strong> <time dateTime={session.scheduledAt}>{format(session.scheduledAt)}</time> <span className="text-muted">· {session.durationMinutes} min</span></p>
          <a className="ui-button is-secondary is-sm" href={`/api/requests/${req.id}/ics`} download><CalendarPlus size={15} aria-hidden="true" />Add to calendar</a>
        </div>
      ) : accepted && session.proposedSlots.length > 0 && !session.proposedByMe ? (
        <div className="space-y-2">
          <p className="text-sm text-body"><strong>{first}</strong> suggested these times ({session.durationMinutes} min). Pick one:</p>
          <div className="flex flex-wrap gap-2">
            {session.proposedSlots.map((slot) => (
              <Button key={slot} size="sm" variant="secondary" disabled={pending} onClick={() => act(() => chooseSessionTimeAction({ requestId: req.id, slot }))} icon={<Clock size={14} aria-hidden="true" />}>
                {format(slot)}
              </Button>
            ))}
          </div>
        </div>
      ) : accepted && session.proposedSlots.length > 0 ? (
        <p className="session-row text-sm text-muted"><Clock size={16} aria-hidden="true" />Waiting for {first} to pick: {session.proposedSlots.map(format).join(" · ")}</p>
      ) : accepted ? (
        <p className="session-row text-sm text-muted"><Clock size={16} aria-hidden="true" />No time set yet. Suggest up to three times that work for you.</p>
      ) : null}

      {accepted && (editing ? (
        <div className="session-propose space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-body">Suggest times (your local time)</legend>
            {slots.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`slot-${req.id}-${index}`}>Option {index + 1}</label>
                <input id={`slot-${req.id}-${index}`} type="datetime-local" className="ui-input sm:max-w-xs" min={min} value={value} onChange={(e) => setSlots((all) => all.map((v, i) => (i === index ? e.target.value : v)))} />
                {slots.length > 1 && <button type="button" className="ui-dialog-close" aria-label={`Remove option ${index + 1}`} onClick={() => setSlots((all) => all.filter((_, i) => i !== index))}><X size={16} aria-hidden="true" /></button>}
              </div>
            ))}
            {slots.length < MAX_PROPOSED_SLOTS && <Button size="sm" variant="ghost" onClick={() => setSlots((all) => [...all, ""])} icon={<Plus size={14} aria-hidden="true" />}>Add another time</Button>}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-body">Length
            <select className="ui-input ui-select !w-auto" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {SESSION_DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={propose} pending={pending} disabled={!slots.some(Boolean)}>Send times</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setMin(toLocalInput(new Date(Date.now() + MIN_SLOT_LEAD_MS))); setEditing(true); }} disabled={pending} icon={<CalendarPlus size={15} aria-hidden="true" />}>{session.scheduledAt || session.proposedSlots.length ? "Suggest different times" : "Suggest times"}</Button>
          {req.mode === "online" && (session.meetingUrl
            ? <a className="ui-button is-primary is-sm" href={session.meetingUrl} target="_blank" rel="noopener noreferrer"><Video size={15} aria-hidden="true" />Join video call</a>
            : <Button size="sm" onClick={openMeeting} pending={pending} icon={<Video size={15} aria-hidden="true" />}>Create video call link</Button>)}
        </div>
      ))}
      {accepted && req.mode === "online" && <p className="text-xs text-muted">Video calls use Jitsi Meet (meet.jit.si) with a private, unguessable room link only you two can see here. The first person to join may be asked to sign in to Jitsi to start the meeting.</p>}
    </section>
  );
}
