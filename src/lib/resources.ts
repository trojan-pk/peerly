import mongoose from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { Resource } from "@/models/Resource";
import { escapeRegex, normalizeTags } from "@/lib/validations/user";
import { requireAuth } from "@/lib/auth-guards";
import { normalizeCourseCode } from "@/lib/course-rules";

export interface PublicResourceDTO {
  id: string;
  title: string;
  description: string;
  topic: string;
  /** Catalogue course code, when the owner tagged one. */
  courseCode: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  contributor: {
    id: string;
    name: string;
    university?: string;
    image?: string;
  };
  moderation?: {
    isHidden: boolean;
    hiddenAt?: string | null;
    reason?: string | null;
  };
}

export type PeerPublishedResourcesResult = {
  state: "success" | "error";
  resources: PublicResourceDTO[];
  message?: string;
};

export interface UserResourcesResult {
  state: "success" | "unconfigured" | "error";
  resources: PublicResourceDTO[];
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  message?: string;
}

export interface ResourceSearchParams {
  q?: string;
  topic?: string;
  page?: string | number;
}

export type ResourcesQueryResult =
  | {
      state: "success";
      resources: PublicResourceDTO[];
      pagination: {
        page: number;
        totalPages: number;
        totalCount: number;
        hasPrev: boolean;
        hasNext: boolean;
      };
      availableTopics: string[];
    }
  | { state: "no_results"; availableTopics: string[] }
  | { state: "database_empty" }
  | { state: "unconfigured" }
  | { state: "error"; message: string };

const PAGE_SIZE = 12;

interface PopulatedOwner {
  _id?: mongoose.Types.ObjectId | string;
  name?: string;
  university?: string;
  image?: string;
}

interface RawPopulatedResource {
  _id: mongoose.Types.ObjectId | string;
  owner?: PopulatedOwner;
  title: string;
  description: string;
  topic: string;
  courseCode?: string;
  course?: mongoose.Types.ObjectId | string | null;
  url: string;
  moderation?: {
    isHidden?: boolean;
    hiddenAt?: Date | null;
    reason?: string | null;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Transforms a raw database resource into a safe public DTO.
 * Guarantees that sensitive contributor fields (email, googleId, private contact)
 * are NEVER included in public responses.
 */
export function toPublicResourceDTO(raw: RawPopulatedResource, includeModeration = false): PublicResourceDTO {
  const contributorId = raw.owner?._id ? raw.owner._id.toString() : "";
  const contributorName = raw.owner?.name?.trim() || "Student Contributor";

  return {
    id: raw._id.toString(),
    title: raw.title,
    description: raw.description,
    topic: raw.topic,
    courseCode: raw.courseCode ?? "",
    url: raw.url,
    createdAt: new Date(raw.createdAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
    contributor: {
      id: contributorId,
      name: contributorName,
      university: raw.owner?.university || undefined,
      image: raw.owner?.image || undefined,
    },
    moderation: includeModeration && raw.moderation
      ? {
          isHidden: Boolean(raw.moderation.isHidden),
          hiddenAt: raw.moderation.hiddenAt ? new Date(raw.moderation.hiddenAt).toISOString() : null,
          reason: raw.moderation.reason || null,
        }
      : undefined,
  };
}

/**
 * Searches and filters published resources from MongoDB with bounded queries,
 * safe regex escaping, stable sorting, and pagination.
 */
export async function queryResources(
  params: ResourceSearchParams = {}
): Promise<ResourcesQueryResult> {
  if (!isDatabaseConfigured()) {
    return { state: "unconfigured" };
  }

  try {
    await connectToDatabase();

    // 1. Check if there are any unhidden resources in the platform at all
    const totalInPlatform = await Resource.countDocuments({
      "moderation.isHidden": { $ne: true },
    });
    if (totalInPlatform === 0) {
      return { state: "database_empty" };
    }

    // 2. Build the filter query
    const query: Record<string, unknown> = {
      "moderation.isHidden": { $ne: true },
    };

    // Bounded search inputs
    const safeQ = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
    const safeTopic = typeof params.topic === "string" ? params.topic.trim().slice(0, 50) : "";

    // Keyword search (q) across title, description, and topic
    if (safeQ.length > 0) {
      const escaped = escapeRegex(safeQ);
      const regex = new RegExp(escaped, "i");
      const code = normalizeCourseCode(safeQ);
      query.$or = [{ title: regex }, { description: regex }, { topic: regex }, { courseCode: regex }, ...(code ? [{ courseCode: code }] : [])];
    }

    // Topic filter (exact match on normalized topic)
    if (safeTopic.length > 0) {
      const escaped = escapeRegex(safeTopic.toLowerCase());
      query.normalizedTopic = new RegExp(`^${escaped}$`, "i");
    }

    // Fetch available unique topics for filter pills (excluding hidden items)
    const rawTopics = await Resource.distinct("topic", {
      "moderation.isHidden": { $ne: true },
    });
    const availableTopics = normalizeTags(rawTopics);

    // 3. Count matching documents
    const totalMatching = await Resource.countDocuments(query);
    if (totalMatching === 0) {
      return {
        state: "no_results",
        availableTopics,
      };
    }

    // 4. Pagination calculations with bounds
    const rawPage =
      typeof params.page === "number"
        ? params.page
        : parseInt(String(params.page || "1"), 10);
    const parsedPage = isNaN(rawPage) ? 1 : rawPage;
    const safePage = Math.max(1, Math.min(parsedPage, 10000));
    const totalPages = Math.ceil(totalMatching / PAGE_SIZE);
    const validPage = Math.min(safePage, totalPages);
    const skip = (validPage - 1) * PAGE_SIZE;

    // 5. Bounded query with stable sort and populate safe owner fields
    const rawDocs = await Resource.find(query)
      .populate("owner", "name university image")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean();

    const resources = (rawDocs as unknown as RawPopulatedResource[]).map((doc) =>
      toPublicResourceDTO(doc)
    );

    return {
      state: "success",
      resources,
      pagination: {
        page: validPage,
        totalPages,
        totalCount: totalMatching,
        hasPrev: validPage > 1,
        hasNext: validPage < totalPages,
      },
      availableTopics,
    };
  } catch (error) {
    console.error("[queryResources] Database error:", error);
    return {
      state: "error",
      message:
        "Academic resources are temporarily unavailable. Please try again shortly.",
    };
  }
}

/**
 * Retrieves public study resources published by a specific peer helper.
 * Displayed on /peers/[id] and does NOT require an accepted study request.
 * Query failures return state: "error" and do NOT silently masquerade as empty results.
 */
export async function getPeerPublishedResources(
  peerId: string,
  limit = 10
): Promise<PeerPublishedResourcesResult> {
  if (!mongoose.Types.ObjectId.isValid(peerId)) {
    return { state: "success", resources: [] };
  }

  if (!isDatabaseConfigured()) {
    return {
      state: "error",
      resources: [],
      message: "Database is not configured.",
    };
  }

  try {
    await connectToDatabase();
    const peerObjectId = new mongoose.Types.ObjectId(peerId);
    const boundedLimit = Math.max(1, Math.min(limit, 50));

    const rawDocs = await Resource.find({
      owner: peerObjectId,
      "moderation.isHidden": { $ne: true },
    })
      .populate("owner", "name university image")
      .sort({ createdAt: -1, _id: -1 })
      .limit(boundedLimit)
      .lean();

    return {
      state: "success",
      resources: (rawDocs as unknown as RawPopulatedResource[]).map((doc) =>
        toPublicResourceDTO(doc)
      ),
    };
  } catch (error) {
    console.error("[getPeerPublishedResources] Database error:", error);
    return {
      state: "error",
      resources: [],
      message: "Peer study resources are temporarily unavailable due to a database error.",
    };
  }
}

/**
 * Retrieves all resources owned by the authenticated user for the management dashboard.
 * Identity is resolved strictly via requireAuth() rather than trusting caller-supplied input.
 * Includes bounded pagination.
 */
export async function getUserResources(
  rawPage: string | number = 1,
  pageSize = 10
): Promise<UserResourcesResult> {
  const authContext = await requireAuth();
  const userObjectId = authContext.user._id as mongoose.Types.ObjectId;

  if (!isDatabaseConfigured()) {
    return {
      state: "unconfigured",
      resources: [],
      pagination: {
        page: 1,
        totalPages: 1,
        totalCount: 0,
        hasPrev: false,
        hasNext: false,
      },
    };
  }

  try {
    await connectToDatabase();
    const boundedPageSize = Math.max(1, Math.min(pageSize, 50));
    const parsedPage =
      typeof rawPage === "number" ? rawPage : parseInt(String(rawPage || "1"), 10);
    const safePage = Math.max(1, Math.min(isNaN(parsedPage) ? 1 : parsedPage, 10000));

    const totalCount = await Resource.countDocuments({ owner: userObjectId });
    const totalPages = Math.max(1, Math.ceil(totalCount / boundedPageSize));
    const validPage = Math.min(safePage, totalPages);
    const skip = (validPage - 1) * boundedPageSize;

    const rawDocs = await Resource.find({ owner: userObjectId })
      .populate("owner", "name university image")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(boundedPageSize)
      .lean();

    const resources = (rawDocs as unknown as RawPopulatedResource[]).map((doc) =>
      toPublicResourceDTO(doc, true)
    );

    return {
      state: "success",
      resources,
      pagination: {
        page: validPage,
        totalPages,
        totalCount,
        hasPrev: validPage > 1,
        hasNext: validPage < totalPages,
      },
    };
  } catch (error) {
    console.error("[getUserResources] Database error:", error);
    return {
      state: "error",
      resources: [],
      pagination: {
        page: 1,
        totalPages: 1,
        totalCount: 0,
        hasPrev: false,
        hasNext: false,
      },
      message: "Unable to load your resources due to a database error. Please try again.",
    };
  }
}
