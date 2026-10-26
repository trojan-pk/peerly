"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { addCourseAction, getCoursesForUniversity, saveMyCoursesAction } from "@/app/actions/courses";
import type { CourseDTO, UniversityDTO } from "@/lib/courses";
import { normalizeCourseCode } from "@/lib/course-rules";

interface Props {
  universities: UniversityDTO[];
  initialUniversityId: string | null;
  initialCourses: CourseDTO[];
  initialSelected: string[];
}

/** Choose your university from the catalogue and the courses you can help with. */
export function CoursesSection({ universities, initialUniversityId, initialCourses, initialSelected }: Props) {
  const toast = useToast();
  const [universityId, setUniversityId] = useState(initialUniversityId ?? "");
  const [courses, setCourses] = useState<CourseDTO[]>(initialCourses);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const preview = code ? normalizeCourseCode(code) : null;

  function changeUniversity(next: string) {
    setUniversityId(next);
    setSelected(new Set());
    setCourses([]);
    if (!next) return;
    startTransition(async () => {
      const result = await getCoursesForUniversity(next);
      if (result.success) setCourses(result.data ?? []);
      else toast.show({ tone: "error", title: result.message ?? "Couldn't load courses." });
    });
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function add() {
    setCodeError(undefined);
    startTransition(async () => {
      const result = await addCourseAction({ universityId, code, title });
      if (!result.success || !result.data) { setCodeError(result.errors?.code ?? result.message); return; }
      const course = result.data;
      setCourses((list) => (list.some((c) => c.id === course.id) ? list : [...list, course].sort((a, b) => a.code.localeCompare(b.code))));
      setSelected((s) => new Set(s).add(course.id));
      setCode(""); setTitle("");
      toast.show({ tone: "success", title: result.message ?? `${course.code} added.`, description: "Save to show it on your profile." });
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveMyCoursesAction({ universityId: universityId || null, courseIds: [...selected] });
      toast.show(result.success ? { tone: "success", title: result.message ?? "Courses saved." } : { tone: "error", title: result.message ?? "Couldn't save courses." });
    });
  }

  if (universities.length === 0) {
    return <p className="text-sm text-muted">No universities are in the catalogue yet. An administrator can add yours; until then, list topics in your profile below.</p>;
  }

  return (
    <div className="course-picker space-y-4">
      <Field label="Your university" hint="Choosing from the list also sets the university shown on your profile.">
        {(p) => (
          <Select {...p} value={universityId} onChange={(e) => changeUniversity(e.target.value)} disabled={pending}>
            <option value="">Not listed / choose later</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
      </Field>

      {universityId && (
        <fieldset className="space-y-2" aria-busy={pending || undefined}>
          <legend className="text-sm font-semibold text-body">Courses you can help with <span className="font-normal text-muted">({selected.size} selected, up to 12)</span></legend>
          {courses.length === 0 ? (
            <p className="text-sm text-muted">No courses yet for this university. Add the first one below.</p>
          ) : (
            <div className="course-grid">
              {courses.map((c) => (
                <label key={c.id} className="course-option">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} disabled={pending || (!selected.has(c.id) && selected.size >= 12)} />
                  <span><strong className="tabular">{c.code}</strong>{c.title && <> · {c.title}</>}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {universityId && (
        <div className="inline-form">
          <Field label="Add a missing course" hint={preview ? <>Will be saved as <strong className="tabular">{preview}</strong></> : "Code like CS-101 or MATH 202"} error={codeError}>
            {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} placeholder="CS 101" />}
          </Field>
          <Field label="Course title (optional)">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Programming Fundamentals" />}</Field>
          <Button variant="secondary" onClick={add} disabled={pending || !code.trim()} icon={<Plus size={16} aria-hidden="true" />}>Add course</Button>
        </div>
      )}

      <div><Button onClick={save} pending={pending} pendingLabel="Saving…">Save university and courses</Button></div>
    </div>
  );
}
