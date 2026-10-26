"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { AlertCircle, CheckCircle2, Clock, Lock, MessageCircle, RotateCcw, Unlock } from "lucide-react";

/** 0 sent · 1 helper reviewing · 2 accepted · 3 contact unlocked. */
type Stage = 0 | 1 | 2 | 3;
const TIMELINE: Array<[Stage, number]> = [[1, 1100], [2, 2300], [3, 3300]];

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

/**
 * The landing's single signature sequence: an urgent request is sent, a helper
 * accepts and contact unlocks. It plays once (Replay restarts it) and shows the
 * final state immediately when the visitor prefers reduced motion. All people and
 * details are illustrative and labelled as such.
 */
export function HeroScene() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(0);
  const [run, setRun] = useState(0);
  const shown: Stage = reduce ? 3 : stage;

  useEffect(() => {
    if (reduce) return;
    const timers = TIMELINE.map(([next, at]) => window.setTimeout(() => setStage(next), at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce, run]);

  const accepted = shown >= 2;
  const unlocked = shown >= 3;

  return (
    <figure className="hero-scene" aria-labelledby="hero-scene-caption" data-stage={shown}>
      <div className="hero-scene-bar">
        <span className="hero-scene-label">Illustrative example</span>
        {!reduce && (
          <button type="button" className="hero-replay" onClick={() => { setStage(0); setRun((r) => r + 1); }} disabled={shown < 3} aria-label="Replay the example">
            <RotateCcw size={14} aria-hidden="true" />Replay
          </button>
        )}
      </div>

      <m.article layout className="scene-card scene-request">
        <div className="scene-row">
          <span className="ui-badge is-danger"><AlertCircle aria-hidden="true" />Urgent</span>
          <span className="scene-course tabular">CS-101</span>
          <span className="scene-countdown tabular"><Clock size={13} aria-hidden="true" />2h 58m</span>
        </div>
        <p className="scene-title">Recursion in C++</p>
        <p>My merge sort overflows the stack on large inputs. Assignment due 11:00 PM.</p>
        <div className="scene-row scene-meta">
          <span>To <strong>Sara K.</strong> · took CS-101 last spring</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span key={accepted ? "accepted" : "pending"} {...fade} className={`ui-badge ${accepted ? "is-success" : "is-warning"}`}>
              {accepted ? <><CheckCircle2 aria-hidden="true" />Accepted</> : <><Clock aria-hidden="true" />{shown === 1 ? "Reading…" : "Pending"}</>}
            </m.span>
          </AnimatePresence>
        </div>
      </m.article>

      <m.div layout className={`scene-card scene-contact ${unlocked ? "is-unlocked" : ""}`} aria-live="off">
        <span className="scene-contact-icon" aria-hidden="true">{unlocked ? <Unlock size={18} /> : <Lock size={18} />}</span>
        <div>
          <strong>{unlocked ? "Contact unlocked" : "Contact stays private"}</strong>
          <span>{unlocked ? "Sara’s chosen WhatsApp is now in your dashboard." : "Shared only if Sara accepts."}</span>
        </div>
        <AnimatePresence initial={false}>
          {unlocked && (
            <m.span {...fade} className="scene-open"><MessageCircle size={15} aria-hidden="true" />Open chat</m.span>
          )}
        </AnimatePresence>
      </m.div>

      <figcaption id="hero-scene-caption" className="sr-only">
        Example: an urgent request about recursion is sent to a student who took the course. She accepts, and only then her chosen contact is shared.
      </figcaption>
    </figure>
  );
}
