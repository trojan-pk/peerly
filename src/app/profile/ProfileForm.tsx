"use client";

import { safeAction } from "@/lib/client-action";

import { useState, useTransition } from "react";
import { updateProfile, ProfileActionState } from "./actions";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { LearningMode, PricingPreference, ContactMethod } from "@/types/user";

export interface ProfileFormData {
  name: string;
  bio: string;
  university: string;
  campus: string;
  topics: string[];
  subjects: string[];
  mode: LearningMode;
  availability: string;
  pricingPreference: PricingPreference;
  contact: {
    whatsapp: string;
    meetingLink: string;
    preferredMethod: ContactMethod;
  };
  isProfileComplete: boolean;
}

interface ProfileFormProps {
  initialData: ProfileFormData;
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const [formData, setFormData] = useState<ProfileFormData>(initialData);
  const [topicsInput, setTopicsInput] = useState<string>(initialData.topics.join(", "));
  const [subjectsInput, setSubjectsInput] = useState<string>(initialData.subjects.join(", "));
  const [isPending, startTransition] = useTransition();
  const [resultState, setResultState] = useState<ProfileActionState | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResultState(null);

    // Parse comma-separated topics and subjects
    const parsedTopics = topicsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const parsedSubjects = subjectsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name,
      bio: formData.bio,
      university: formData.university,
      campus: formData.campus,
      topics: parsedTopics,
      subjects: parsedSubjects,
      mode: formData.mode,
      availability: formData.availability,
      pricingPreference: formData.pricingPreference,
      contact: {
        whatsapp: formData.contact.whatsapp,
        meetingLink: formData.contact.meetingLink,
        preferredMethod: formData.contact.preferredMethod,
      },
    };

    startTransition(async () => {
      const res = await safeAction(() => updateProfile(payload));
      setResultState(res);
      if (res.success && typeof res.isComplete === "boolean") {
        setFormData((prev) => ({
          ...prev,
          topics: parsedTopics,
          subjects: parsedSubjects,
          isProfileComplete: res.isComplete!,
        }));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Status Notifications */}
      {resultState && resultState.success && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/10 p-4 flex items-start gap-3 text-xs text-accent shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{resultState.message || "Profile saved successfully."}</p>
            <p className="text-accent">
              {resultState.isComplete
                ? "Your profile is active and discoverable in the peer directory."
                : "Your profile was saved. Complete university and at least one topic to appear in peer discovery."}
            </p>
          </div>
        </div>
      )}

      {resultState && !resultState.success && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-danger/25 bg-danger/10 p-4 flex items-start gap-3 text-xs text-danger shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">{resultState.message || "Could not save profile."}</p>
            {resultState.errors && Object.keys(resultState.errors).length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-danger mt-1">
                {Object.entries(resultState.errors).map(([field, err]) => (
                  <li key={field}>
                    <span className="font-medium capitalize">{field.replace(".", " ")}</span>: {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Profile Completion Indicator */}
      <div className="rounded-xl border border-line bg-panel p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" aria-hidden="true" />
          <span className="font-medium text-ink">Directory Status:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full font-semibold ${
              formData.isProfileComplete
                ? "bg-accent/15 text-accent"
                : "bg-warning/15 text-warning"
            }`}
          >
            {formData.isProfileComplete ? "Complete & Discoverable" : "Incomplete (Hidden from Search)"}
          </span>
        </div>
        <span className="text-muted hidden sm:inline">
          {formData.isProfileComplete
            ? "Peers can find you for coursework help"
            : "Fill in university, topics, and availability to publish"}
        </span>
      </div>

      {/* Section 1: Academic & Basic Identity */}
      <fieldset className="rounded-2xl border border-line/90 bg-surface p-6 sm:p-7 space-y-5 shadow-xs">
        <legend className="text-base font-bold text-ink px-1">
          Academic Identity
        </legend>
        <p className="text-xs text-muted -mt-3">
          Information shared with classmates and peers looking for study help.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-xs font-semibold text-ink">
              Full Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              aria-describedby={resultState?.errors?.name ? "name-error" : undefined}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 transition-colors ${
                resultState?.errors?.name
                  ? "border-danger/25 focus:ring-red-400"
                  : "border-edge focus:ring-accent"
              }`}
            />
            {resultState?.errors?.name && (
              <p id="name-error" className="text-xs text-danger">
                {resultState.errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="university" className="block text-xs font-semibold text-ink">
              University / Institution <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              id="university"
              name="university"
              required
              maxLength={200}
              placeholder="e.g. Stanford University"
              value={formData.university}
              onChange={(e) => setFormData({ ...formData, university: e.target.value })}
              aria-describedby={resultState?.errors?.university ? "university-error" : undefined}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 transition-colors ${
                resultState?.errors?.university
                  ? "border-danger/25 focus:ring-red-400"
                  : "border-edge focus:ring-accent"
              }`}
            />
            {resultState?.errors?.university && (
              <p id="university-error" className="text-xs text-danger">
                {resultState.errors.university}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="campus" className="block text-xs font-semibold text-ink">
              Campus / Faculty
            </label>
            <input
              type="text"
              id="campus"
              name="campus"
              maxLength={200}
              placeholder="e.g. Main Campus, School of Engineering"
              value={formData.campus}
              onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bio" className="block text-xs font-semibold text-ink">
              Bio / Study Focus
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={2}
              maxLength={1000}
              placeholder="Brief overview of what courses you excel at or want to help with..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            />
          </div>
        </div>
      </fieldset>

      {/* Section 2: Study Help Topics & Availability */}
      <fieldset className="rounded-2xl border border-line/90 bg-surface p-6 sm:p-7 space-y-5 shadow-xs">
        <legend className="text-base font-bold text-ink px-1">
          Topics, Subjects &amp; Availability
        </legend>
        <p className="text-xs text-muted -mt-3">
          Tell fellow students where you can offer help and when you are free.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="topics" className="block text-xs font-semibold text-ink">
            Topics (comma-separated) <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            id="topics"
            name="topics"
            placeholder="e.g. Linear Algebra, Data Structures, Organic Chemistry"
            value={topicsInput}
            onChange={(e) => setTopicsInput(e.target.value)}
            aria-describedby="topics-help"
            className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          />
          <p id="topics-help" className="text-[11px] text-muted">
            Separate topics with commas so classmates can find what you can explain.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="subjects" className="block text-xs font-semibold text-ink">
            Broader Subjects or Courses (comma-separated)
          </label>
          <input
            type="text"
            id="subjects"
            name="subjects"
            placeholder="e.g. Computer Science, Mathematics, Biology"
            value={subjectsInput}
            onChange={(e) => setSubjectsInput(e.target.value)}
            aria-describedby="subjects-help"
            className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          />
          <p id="subjects-help" className="text-[11px] text-muted">
            General department or program areas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Learning Mode */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink">
              Learning Mode
            </legend>
            <div className="space-y-2">
              {[
                { value: "online", label: "Online only", desc: "Remote video or meeting links" },
                { value: "campus", label: "In-person on campus", desc: "Campus library or study rooms" },
                { value: "both", label: "Both online & in-person", desc: "Flexible for either mode" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.mode === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line hover:bg-panel text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={opt.value}
                    checked={formData.mode === opt.value}
                    onChange={() => setFormData({ ...formData, mode: opt.value as LearningMode })}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="block text-xs font-semibold">{opt.label}</span>
                    <span className="block text-[11px] text-muted">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Pricing Preference */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink">
              Pricing Preference
            </legend>
            <div className="space-y-2">
              {[
                { value: "free", label: "Free peer exchange", desc: "Volunteer mutual learning" },
                { value: "paid", label: "Paid tutoring preference", desc: "Private arrangement" },
                { value: "both", label: "Open to both", desc: "Flexible depending on request" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.pricingPreference === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line hover:bg-panel text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="pricingPreference"
                    value={opt.value}
                    checked={formData.pricingPreference === opt.value}
                    onChange={() =>
                      setFormData({ ...formData, pricingPreference: opt.value as PricingPreference })
                    }
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="block text-xs font-semibold">{opt.label}</span>
                    <span className="block text-[11px] text-muted">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-1.5 pt-2">
          <label htmlFor="availability" className="block text-xs font-semibold text-ink">
            Availability Schedule <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            id="availability"
            name="availability"
            maxLength={500}
            placeholder="e.g. Monday & Wednesday afternoons (2-5 PM), weekends by appointment"
            value={formData.availability}
            onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
            aria-describedby={resultState?.errors?.availability ? "availability-error" : "availability-help"}
            className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          />
          {resultState?.errors?.availability ? (
            <p id="availability-error" className="text-xs text-danger">
              {resultState.errors.availability}
            </p>
          ) : (
            <p id="availability-help" className="text-[11px] text-muted">
              When can peers reasonably reach out or schedule a session with you?
            </p>
          )}
        </div>
      </fieldset>

      {/* Section 3: Private Contact Details */}
      <fieldset className="rounded-2xl border border-line/90 bg-surface p-6 sm:p-7 space-y-5 shadow-xs">
        <div className="flex items-center gap-2">
          <legend className="text-base font-bold text-ink px-1">
            Private Contact Settings
          </legend>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/10 text-accent border border-accent/25">
            <Lock className="w-3 h-3" aria-hidden="true" />
            Hidden until request accepted
          </span>
        </div>
        <p className="text-xs text-muted -mt-3">
          These details are never exposed in search or public profiles. They are only shared with a student after you explicitly accept their study request.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="whatsapp" className="block text-xs font-semibold text-ink">
              WhatsApp Number
            </label>
            <input
              type="tel"
              id="whatsapp"
              name="whatsapp"
              maxLength={30}
              placeholder="e.g. +1 555 123 4567"
              value={formData.contact.whatsapp}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, whatsapp: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="meetingLink" className="block text-xs font-semibold text-ink">
              Personal Meeting Link (HTTP/HTTPS)
            </label>
            <input
              type="url"
              id="meetingLink"
              name="meetingLink"
              maxLength={200}
              placeholder="https://meet.google.com/abc-defg-hij"
              value={formData.contact.meetingLink}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contact: { ...formData.contact, meetingLink: e.target.value },
                })
              }
              aria-describedby={resultState?.errors?.["contact.meetingLink"] ? "meetingLink-error" : undefined}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 transition-colors ${
                resultState?.errors?.["contact.meetingLink"]
                  ? "border-danger/25 focus:ring-red-400"
                  : "border-edge focus:ring-accent"
              }`}
            />
            {resultState?.errors?.["contact.meetingLink"] && (
              <p id="meetingLink-error" className="text-xs text-danger">
                {resultState.errors["contact.meetingLink"]}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="preferredMethod" className="block text-xs font-semibold text-ink">
            Preferred Contact Method
          </label>
          <select
            id="preferredMethod"
            name="preferredMethod"
            value={formData.contact.preferredMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                contact: {
                  ...formData.contact,
                  preferredMethod: e.target.value as ContactMethod,
                },
              })
            }
            className="w-full sm:w-64 px-3.5 py-2.5 rounded-lg border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="unspecified">Unspecified (Peer chooses)</option>
            <option value="email">Google Account Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="meeting_link">Meeting Link</option>
          </select>
        </div>
      </fieldset>

      {/* Submit Button & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <HelpCircle className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
          <span>Fields marked with <span className="text-accent font-bold">*</span> are required for peer discovery.</span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-action hover:bg-action-hover text-white text-sm font-semibold transition-all shadow-xs min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Saving profile...</span>
            </>
          ) : (
            <span>Save Profile &amp; Preferences</span>
          )}
        </button>
      </div>
    </form>
  );
}
