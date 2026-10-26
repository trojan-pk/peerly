"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { adminCreateUniversityAction, adminMergeCoursesAction, adminSetCourseHiddenAction, adminUpdateUniversityAction } from "@/app/actions/courses";
import type { CourseDTO, UniversityDTO } from "@/lib/courses";

export function AdminCatalogView({ universities, selectedId, courses }: { universities: UniversityDTO[]; selectedId: string | null; courses: CourseDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selected = universities.find((u) => u.id === selectedId) ?? null;
  const [editDomains, setEditDomains] = useState(selected?.domains.join(", ") ?? "");
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  function run(action: () => Promise<{ success: boolean; message?: string; errors?: Record<string, string> }>, after?: () => void) {
    setErrors({});
    startTransition(async () => {
      const result = await action();
      if (result.success) { toast.show({ tone: "success", title: result.message ?? "Saved." }); after?.(); router.refresh(); }
      else { setErrors(result.errors ?? {}); toast.show({ tone: "error", title: result.message ?? "Couldn't save." }); }
    });
  }

  const active = courses.filter((c) => !c.isHidden);

  return (
    <div className="space-y-8">
      <Card as="section" aria-labelledby="add-uni-title" className="space-y-4">
        <h2 id="add-uni-title" className="text-lg font-semibold text-ink">Add a university</h2>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => adminCreateUniversityAction({ name, domains }), () => { setName(""); setDomains(""); }); }}>
          <Field label="Name" error={errors.name}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="FAST-NU Lahore" />}</Field>
          <Field label="Email domains" hint="Comma-separated, e.g. nu.edu.pk, lhr.nu.edu.pk" error={errors.domains}>{(p) => <Input {...p} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="nu.edu.pk" />}</Field>
          <Button type="submit" pending={pending} icon={<Plus size={16} aria-hidden="true" />}>Add university</Button>
        </form>
      </Card>

      {universities.length === 0 ? (
        <p className="text-muted">No universities yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Universities">
            <ul className="space-y-1">
              {universities.map((u) => (
                <li key={u.id}>
                  {u.id === selectedId ? (
                    <span aria-current="page" className="flex justify-between gap-2 rounded-lg bg-raised px-3 py-2 text-sm font-semibold text-ink">{u.name}<span className="tabular text-muted">{u.courseCount ?? 0}</span></span>
                  ) : (
                    <Link href={`/admin/universities?university=${u.id}`} className="flex justify-between gap-2 rounded-lg px-3 py-2 text-sm text-body hover:bg-panel">{u.name}<span className="tabular text-muted">{u.courseCount ?? 0}</span></Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {selected && (
            <div className="space-y-6" key={selected.id}>
              <Card as="section" aria-labelledby="uni-settings-title" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="uni-settings-title" className="text-lg font-semibold text-ink">{selected.name}</h2>
                  {selected.isHidden ? <Badge tone="warning">Hidden</Badge> : <Badge tone="success">Visible</Badge>}
                </div>
                <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => adminUpdateUniversityAction({ universityId: selected.id, domains: editDomains })); }}>
                  <Field label="Email domains" error={errors.domains}>{(p) => <Input {...p} value={editDomains} onChange={(e) => setEditDomains(e.target.value)} />}</Field>
                  <Button type="submit" variant="secondary" disabled={pending}>Save domains</Button>
                  <Button variant={selected.isHidden ? "secondary" : "danger"} disabled={pending} onClick={() => run(() => adminUpdateUniversityAction({ universityId: selected.id, isHidden: !selected.isHidden }))}>{selected.isHidden ? "Show university" : "Hide university"}</Button>
                </form>
              </Card>

              <Card as="section" aria-labelledby="courses-admin-title" className="space-y-4">
                <h2 id="courses-admin-title" className="text-lg font-semibold text-ink">Courses</h2>
                {courses.length === 0 ? <p className="text-muted text-sm">No courses yet. Students add them from Settings.</p> : (
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead><tr><th scope="col">Code</th><th scope="col">Title</th><th scope="col">Helpers</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                      <tbody>
                        {courses.map((c) => (
                          <tr key={c.id}>
                            <td className="tabular font-semibold text-ink">{c.code}</td>
                            <td>{c.title || <span className="text-faint">—</span>}</td>
                            <td className="tabular">{c.helperCount ?? 0}</td>
                            <td>{c.isHidden ? <Badge tone="warning">Hidden</Badge> : <Badge tone="success">Visible</Badge>}</td>
                            <td className="text-right"><Button size="sm" variant={c.isHidden ? "secondary" : "ghost"} disabled={pending} onClick={() => run(() => adminSetCourseHiddenAction({ courseId: c.id, isHidden: !c.isHidden }))} aria-label={`${c.isHidden ? "Show" : "Hide"} ${c.code}`}>{c.isHidden ? "Show" : "Hide"}</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {active.length >= 2 && (
                  <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => adminMergeCoursesAction({ sourceId: mergeSource, targetId: mergeTarget }), () => { setMergeSource(""); setMergeTarget(""); }); }}>
                    <Field label="Merge duplicate">{(p) => <Select {...p} value={mergeSource} onChange={(e) => setMergeSource(e.target.value)}><option value="">Choose…</option>{active.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>}</Field>
                    <Field label="into">{(p) => <Select {...p} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}><option value="">Choose…</option>{active.filter((c) => c.id !== mergeSource).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</Select>}</Field>
                    <Button type="submit" variant="secondary" disabled={pending || !mergeSource || !mergeTarget}>Merge courses</Button>
                  </form>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
