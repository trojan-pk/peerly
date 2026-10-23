import { describe, it, expect } from "vitest";
import { toPublicProfile, toAuthorizedContact } from "@/models/User";
import { ProfileUpdateSchema } from "@/lib/validations/user";

describe("User Model & Privacy Protections", () => {
  const mockUserRecord = {
    _id: "6714e5a9c3d4f50123456789",
    googleId: "google-oauth2|109283746501928374",
    email: "student@university.edu",
    name: "Alex Johnson",
    image: "https://lh3.googleusercontent.com/avatar",
    role: "student" as const,
    bio: "Computer Science junior helping with Algorithms & Data Structures.",
    university: "State University",
    campus: "Main Campus",
    topics: ["Calculus II", "Data Structures", "Linear Algebra"],
    subjects: ["Computer Science", "Mathematics"],
    mode: "both" as const,
    availability: "Weekdays after 4 PM",
    pricingPreference: "free" as const,
    contact: {
      whatsapp: "+15551234567",
      meetingLink: "https://meet.google.com/abc-defg-hij",
      preferredMethod: "whatsapp" as const,
    },
    isProfileComplete: true,
    reviewCount: 4,
    averageRating: 4.8,
    responseCount: 5,
    averageResponseTimeHours: 1.5,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-15T12:00:00Z"),
  };

  it("strictly excludes private email, googleId, and contact details from public profiles", () => {
    const publicProfile = toPublicProfile(mockUserRecord);

    // Public fields preserved
    expect(publicProfile.id).toBe("6714e5a9c3d4f50123456789");
    expect(publicProfile.name).toBe("Alex Johnson");
    expect(publicProfile.bio).toBe("Computer Science junior helping with Algorithms & Data Structures.");
    expect(publicProfile.university).toBe("State University");
    expect(publicProfile.topics).toContain("Data Structures");
    expect(publicProfile.pricingPreference).toBe("free");

    // Critical privacy guarantees
    const rawProfile = publicProfile as unknown as Record<string, unknown>;
    expect(rawProfile.email).toBeUndefined();
    expect(rawProfile.googleId).toBeUndefined();
    expect(rawProfile.contact).toBeUndefined();
    expect(rawProfile.whatsapp).toBeUndefined();
    expect(rawProfile.meetingLink).toBeUndefined();
  });

  it("reveals authorized contact details only through authorized transformer", () => {
    const contact = toAuthorizedContact(mockUserRecord);

    expect(contact.peerId).toBe("6714e5a9c3d4f50123456789");
    expect(contact.peerName).toBe("Alex Johnson");
    expect(contact.email).toBe("student@university.edu");
    expect(contact.whatsapp).toBe("+15551234567");
    expect(contact.meetingLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(contact.preferredMethod).toBe("whatsapp");
  });

  it("prevents privilege escalation by disallowing role modification in ProfileUpdateSchema", () => {
    const payloadWithRole = {
      name: "Alex Student",
      bio: "Learning React",
      mode: "online" as const,
      topics: ["React"],
      subjects: ["Web Dev"],
      role: "admin", // Malicious attempt to escalate privileges
    };

    // Strict schema rejects unrecognized/privileged fields
    expect(() => ProfileUpdateSchema.parse(payloadWithRole)).toThrow();
  });

  it("validates meeting link formatting strictly as HTTP/HTTPS or empty", () => {
    // Invalid protocol should fail
    expect(() =>
      ProfileUpdateSchema.parse({
        name: "Test User",
        contact: {
          meetingLink: "javascript:alert(1)",
        },
      })
    ).toThrow();

    // Valid HTTPS link should pass
    const valid = ProfileUpdateSchema.parse({
      name: "Test User",
      contact: {
        meetingLink: "https://meet.google.com/xyz",
      },
    });
    expect(valid.contact.meetingLink).toBe("https://meet.google.com/xyz");
  });
});
