"use client";

import { useState } from "react";
import { BookOpen, Check, Clock, Inbox, Plus, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ThemeToggle";

export function UiShowcase() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div className="workspace-page max-w-5xl mx-auto py-10 space-y-10" data-testid="ui-showcase">
      <header className="space-y-3">
        <p className="tabular text-sm text-muted">DEV · /dev/ui</p>
        <h1 className="font-display text-5xl text-ink">Paper &amp; Ink <span className="highlight-mark" data-draw>primitives</span></h1>
        <p className="text-body max-w-2xl">Reference examples for the shared components. Static content only.</p>
        <ThemeToggle />
      </header>

      <Card as="section" aria-labelledby="buttons-title" className="space-y-4">
        <h2 id="buttons-title" className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button icon={<Check size={16} aria-hidden="true" />}>Accept request</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Decline</Button>
          <Button pending pendingLabel="Saving…">Save</Button>
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Card>

      <Card as="section" aria-labelledby="badges-title" className="space-y-4">
        <h2 id="badges-title" className="text-lg font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge><Badge tone="accent">CS-101</Badge><Badge tone="success" icon={<Check aria-hidden="true" />}>Accepted</Badge>
          <Badge tone="warning" icon={<Clock aria-hidden="true" />}>Pending</Badge><Badge tone="danger">Urgent</Badge><Badge tone="info">Online</Badge><Badge tone="highlight">New</Badge>
        </div>
        <p className="tabular text-2xl text-ink">2h 58m left</p>
      </Card>

      <Card as="section" aria-labelledby="fields-title" className="grid gap-5 sm:grid-cols-2">
        <h2 id="fields-title" className="text-lg font-semibold sm:col-span-2">Fields</h2>
        <Field label="Topic" hint="Be specific, e.g. “Recursion in C++”." required>{(p) => <Input {...p} placeholder="What are you stuck on?" />}</Field>
        <Field label="Mode">{(p) => <Select {...p} defaultValue="online"><option value="online">Online</option><option value="campus">Campus</option></Select>}</Field>
        <Field label="Problem" error="Please describe the problem in at least 10 characters." className="sm:col-span-2">{(p) => <Textarea {...p} defaultValue="Help" />}</Field>
      </Card>

      <Card as="section" aria-labelledby="feedback-title" className="space-y-4">
        <h2 id="feedback-title" className="text-lg font-semibold">Dialog and toasts</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen(true)} data-testid="open-dialog">Open dialog</Button>
          <Button variant="secondary" onClick={() => toast.show({ tone: "success", title: "Request accepted", description: "Contact details are now visible to the learner." })} data-testid="toast-success">Success toast</Button>
          <Button variant="secondary" onClick={() => toast.show({ tone: "error", title: "Couldn’t accept", description: "The request expired before you responded." })} data-testid="toast-error">Error toast</Button>
        </div>
        <Dialog open={open} onClose={() => setOpen(false)} title="Accept this request?" description="The learner will see your chosen contact details." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)} data-autofocus>Accept</Button></>}>
          <Field label="Optional note">{(p) => <Input {...p} />}</Field>
        </Dialog>
      </Card>

      <section aria-labelledby="states-title" className="grid gap-5 sm:grid-cols-2">
        <h2 id="states-title" className="text-lg font-semibold sm:col-span-2">Loading and empty states</h2>
        <Card aria-busy="true" aria-label="Loading example" className="space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></Card>
        <EmptyState icon={<Inbox size={20} />} title="No requests yet" action={<Button size="sm" icon={<Search size={15} aria-hidden="true" />}>Find a peer</Button>}>When someone asks you for help, it appears here.</EmptyState>
        <EmptyState icon={<BookOpen size={20} />} title="Share your first resource" action={<Button size="sm" variant="secondary" icon={<Plus size={15} aria-hidden="true" />}>Add a link</Button>}>Notes and guides you share help classmates studying the same topic.</EmptyState>
      </section>
    </div>
  );
}
