import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryPeers } from "@/lib/peers";
import { User, toPublicProfile } from "@/models/User";
import * as dbModule from "@/lib/db";
import { escapeRegex } from "@/lib/validations/user";

describe("Peer Discovery, Search Filters & Public Data Privacy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, "isDatabaseConfigured").mockReturnValue(true);
    vi.spyOn(dbModule, "connectToDatabase").mockResolvedValue({} as any);
  });

  describe("Regex Input Escaping", () => {
    it("safely escapes regex metacharacters in user search queries", () => {
      const specialInputs = [
        "C++",
        "React (Next.js)",
        "Math [101]",
        "Python.py",
        "$100",
        "^Start*End?",
      ];

      for (const input of specialInputs) {
        const escaped = escapeRegex(input);
        // Validates that constructing a RegExp from the escaped input does NOT throw or act as wildcards
        expect(() => new RegExp(escaped, "i")).not.toThrow();
      }

      expect(escapeRegex("C++")).toBe("C\\+\\+");
      expect(escapeRegex("React (Next.js)")).toBe("React\\ \\(Next\\.js\\)");
      expect(escapeRegex("Math [101]")).toBe("Math\\ \\[101\\]");
    });
  });

  describe("Search & Filter Logic in queryPeers()", () => {
    it("distinguishes genuinely empty database from no results matching filters", async () => {
      // 0 completed profiles in system -> database_empty
      vi.spyOn(User, "countDocuments").mockResolvedValue(0 as any);

      const res = await queryPeers({ q: "Calculus" });
      expect(res.state).toBe("database_empty");
    });

    it("returns no_results when database has peers but query matches 0", async () => {
      // Total complete in database is 15, but matching current query is 0
      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(15 as any) // totalComplete
        .mockResolvedValueOnce(0 as any); // totalMatching

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce(["Algorithms"] as any)
        .mockResolvedValueOnce(["Computer Science"] as any);

      const res = await queryPeers({ topic: "NonExistentTopic" });
      expect(res.state).toBe("no_results");
    });

    it("includes profiles offering 'both' when filtering mode=online", async () => {
      let capturedQuery: any = null;

      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(10 as any) // totalComplete
        .mockResolvedValueOnce(3 as any); // totalMatching

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce(["Calculus"] as any)
        .mockResolvedValueOnce(["Math"] as any);

      vi.spyOn(User, "find").mockImplementation((query: any) => {
        capturedQuery = query;
        return {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue([
            {
              _id: "p1",
              name: "Peer Online",
              mode: "online",
              pricingPreference: "free",
              isProfileComplete: true,
              topics: ["Calculus"],
              subjects: ["Math"],
            },
          ]),
        } as any;
      });

      const res = await queryPeers({ mode: "online" });
      expect(res.state).toBe("success");
      expect(capturedQuery.mode).toEqual({ $in: ["online", "both"] });
    });

    it("includes profiles offering 'both' when filtering mode=campus", async () => {
      let capturedQuery: any = null;

      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(10 as any)
        .mockResolvedValueOnce(2 as any);

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.spyOn(User, "find").mockImplementation((query: any) => {
        capturedQuery = query;
        return {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue([]),
        } as any;
      });

      await queryPeers({ mode: "campus" });
      expect(capturedQuery.mode).toEqual({ $in: ["campus", "both"] });
    });

    it("includes profiles offering 'both' when filtering pricing=free", async () => {
      let capturedQuery: any = null;

      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(10 as any)
        .mockResolvedValueOnce(2 as any);

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.spyOn(User, "find").mockImplementation((query: any) => {
        capturedQuery = query;
        return {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue([]),
        } as any;
      });

      await queryPeers({ pricing: "free" });
      expect(capturedQuery.pricingPreference).toEqual({ $in: ["free", "both"] });
    });

    it("includes profiles offering 'both' when filtering pricing=paid", async () => {
      let capturedQuery: any = null;

      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(10 as any)
        .mockResolvedValueOnce(2 as any);

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.spyOn(User, "find").mockImplementation((query: any) => {
        capturedQuery = query;
        return {
          sort: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          lean: vi.fn().mockResolvedValue([]),
        } as any;
      });

      await queryPeers({ pricing: "paid" });
      expect(capturedQuery.pricingPreference).toEqual({ $in: ["paid", "both"] });
    });

    it("enforces stable sorting ({ createdAt: -1, _id: -1 }) and bounded pagination", async () => {
      let capturedSort: any = null;
      let capturedLimit: any = null;
      let capturedSkip: any = null;

      vi.spyOn(User, "countDocuments")
        .mockResolvedValueOnce(50 as any)
        .mockResolvedValueOnce(50 as any);

      vi.spyOn(User, "distinct")
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.spyOn(User, "find").mockImplementation(() => {
        return {
          sort: vi.fn((sortObj) => {
            capturedSort = sortObj;
            return {
              skip: vi.fn((skipNum) => {
                capturedSkip = skipNum;
                return {
                  limit: vi.fn((limitNum) => {
                    capturedLimit = limitNum;
                    return {
                      lean: vi.fn().mockResolvedValue([]),
                    };
                  }),
                };
              }),
            };
          }),
        } as any;
      });

      const res = await queryPeers({ page: "2" });
      expect(res.state).toBe("success");
      expect(capturedSort).toEqual({ createdAt: -1, _id: -1 });
      expect(capturedLimit).toBe(12);
      expect(capturedSkip).toBe(12); // (2 - 1) * 12
    });
  });

  describe("Public-Data Privacy Guarantee", () => {
    it("ensures toPublicProfile strictly strips email, googleId, and private contact info", () => {
      const fullDbUser = {
        _id: "507f1f77bcf86cd799439011",
        googleId: "google_private_identity_12345",
        email: "student_secret_address@university.edu",
        name: "Samantha Learner",
        image: "https://example.com/avatar.png",
        bio: "Pre-med student offering Biology help.",
        university: "State University",
        campus: "North Campus",
        topics: ["Genetics", "Microbiology"],
        subjects: ["Biology"],
        mode: "both",
        availability: "Weekdays",
        pricingPreference: "free",
        isProfileComplete: true,
        contact: {
          whatsapp: "+19876543210",
          meetingLink: "https://meet.google.com/private-room",
          preferredMethod: "whatsapp",
        },
        reviewCount: 0,
        averageRating: 0,
        responseCount: 0,
        averageResponseTimeHours: null,
        createdAt: new Date(),
      };

      const publicDto = toPublicProfile(fullDbUser as any);

      // Verify public properties are preserved
      expect(publicDto.id).toBe("507f1f77bcf86cd799439011");
      expect(publicDto.name).toBe("Samantha Learner");
      expect(publicDto.university).toBe("State University");
      expect(publicDto.topics).toEqual(["Genetics", "Microbiology"]);

      // STRICTLY VERIFY PRIVATE PROPERTIES ARE ABSENT
      expect((publicDto as any).email).toBeUndefined();
      expect((publicDto as any).googleId).toBeUndefined();
      expect((publicDto as any).contact).toBeUndefined();
      expect((publicDto as any).whatsapp).toBeUndefined();
      expect((publicDto as any).meetingLink).toBeUndefined();
    });
  });

  describe("Peer Detail Page Outage vs 404 Distinction", () => {
    it("renders temporary error state on database outage and does not call notFound()", async () => {
      const notFoundSpy = vi.fn();
      vi.doMock("next/navigation", () => ({
        notFound: notFoundSpy,
      }));

      // Simulate database failure
      vi.spyOn(User, "findById").mockImplementation(() => {
        throw new Error("MongoDB connection timeout");
      });

      const PeerDetailPage = (await import("@/app/peers/[id]/page")).default;
      const res: any = await PeerDetailPage({
        params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }),
      });

      expect(notFoundSpy).not.toHaveBeenCalled();

      function extractText(node: any): string {
        if (!node) return "";
        if (typeof node === "string" || typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(extractText).join(" ");
        if (node.props?.children) return extractText(node.props.children);
        return "";
      }

      const text = extractText(res);
      expect(text).toContain("Peer Profile Temporarily Unavailable");
    });
  });
});
