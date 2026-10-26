import { ImageResponse } from "next/og";
import { getPublicHelperPage } from "@/lib/helper-page";
import { isDatabaseConfigured } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Peer helper summary on Peerly";

/** Share image with the same public numbers as the page; 404 when the page is off. */
export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const page = isDatabaseConfigured() ? await getPublicHelperPage(slug).catch(() => null) : null;
  if (!page) return new Response("Not found", { status: 404 });
  const stats = [
    [String(page.completedSessions), page.completedSessions === 1 ? "completed session" : "completed sessions"],
    [page.reviewCount ? `${page.averageRating.toFixed(1)}★` : "New", page.reviewCount ? `${page.reviewCount} ${page.reviewCount === 1 ? "review" : "reviews"}` : "no reviews yet"],
    ...(page.averageResponse ? [[page.averageResponse, "typical response"]] : []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f7f4ec", color: "#141b2d" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#2c46b1", fontWeight: 700 }}>peerly · peer helper</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{page.name}</div>
          <div style={{ fontSize: 34, color: "#4c5366", marginTop: 14 }}>{page.verifiedUniversityName ? `${page.verifiedUniversityName} · university email verified` : page.university || "University student"}</div>
          {page.courseCodes.length > 0 && <div style={{ fontSize: 30, color: "#2e3546", marginTop: 18 }}>{page.courseCodes.slice(0, 6).join("  ·  ")}</div>}
        </div>
        <div style={{ display: "flex", gap: 56 }}>
          {stats.map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 56, fontWeight: 700 }}>{value}</div>
              <div style={{ fontSize: 26, color: "#4c5366" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
