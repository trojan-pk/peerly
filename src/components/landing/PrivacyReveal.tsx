"use client";

import { useState } from "react";
import { Lock, Mail, MessageCircle, Unlock, Video } from "lucide-react";

/** Shows what a learner sees before and after a helper accepts. Values are placeholders. */
export function PrivacyReveal() {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="privacy-demo">
      <div className="segmented" role="group" aria-label="Request state">
        <button type="button" aria-pressed={!accepted} onClick={() => setAccepted(false)}>Before they accept</button>
        <button type="button" aria-pressed={accepted} onClick={() => setAccepted(true)}>After they accept</button>
      </div>
      <div className={`privacy-card ${accepted ? "is-unlocked" : ""}`} data-testid="privacy-card">
        <div className="privacy-head">
          <span aria-hidden="true">{accepted ? <Unlock size={18} /> : <Lock size={18} />}</span>
          <strong>{accepted ? "Visible to you only" : "Hidden from everyone"}</strong>
        </div>
        <ul>
          <li><MessageCircle size={16} aria-hidden="true" /><span>WhatsApp</span><span className="privacy-value tabular" aria-label={accepted ? "Shown after acceptance" : "Hidden"}>{accepted ? "+92 3xx xxx xxxx" : "•••• ••• ••••"}</span></li>
          <li><Video size={16} aria-hidden="true" /><span>Meeting link</span><span className="privacy-value" aria-label={accepted ? "Shown after acceptance" : "Hidden"}>{accepted ? "meet.example/your-room" : "•••••••••••"}</span></li>
          <li><Mail size={16} aria-hidden="true" /><span>Email</span><span className="privacy-value">{accepted ? "Only if they choose to share it" : "Never in search"}</span></li>
        </ul>
        <p className="privacy-note">{accepted ? "Only the learner on an accepted request sees this, and it stays available after the session for follow-ups." : "Search results, profiles, notifications and emails never include contact details."}</p>
      </div>
    </div>
  );
}
