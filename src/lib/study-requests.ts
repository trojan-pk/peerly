import mongoose from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db";
import { StudyRequest, RequestStatus, RequestMode } from "@/models/StudyRequest";
import { User } from "@/models/User";
import { buildSafeUnlockedContact, SafeUnlockedContact } from "@/lib/contact-unlock";
import { requireAuth } from "@/lib/auth-guards";

interface PopulatedParticipant {
  _id?: mongoose.Types.ObjectId | string;
  name?: string;
  image?: string;
  university?: string;
}

interface RawPopulatedStudyRequest {
  _id: mongoose.Types.ObjectId | string;
  learner?: PopulatedParticipant;
  peer?: PopulatedParticipant;
  topic: string;
  problemDescription: string;
  mode: RequestMode;
  status: RequestStatus;
  respondedAt?: Date | null;
  learnerConfirmedAt?: Date | null;
  peerConfirmedAt?: Date | null;
  review?: {
    rating: number;
    comment: string;
    createdAt?: Date | string;
  } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ParticipantBrief {
  id: string;
  name: string;
  image?: string;
  university?: string;
}

export interface ReviewDTO {
  rating: number;
  comment: string;
  createdAt: string;
}

export interface StudyRequestDTO {
  id: string;
  learner: ParticipantBrief;
  peer: ParticipantBrief;
  topic: string;
  problemDescription: string;
  mode: RequestMode;
  status: RequestStatus;
  respondedAt?: string | null;
  learnerConfirmedAt?: string | null;
  peerConfirmedAt?: string | null;
  review?: ReviewDTO | null;
  createdAt: string;
  updatedAt: string;
  unlockedContact?: SafeUnlockedContact | null;
}

export interface DashboardRequestsResult {
  incoming: {
    items: StudyRequestDTO[];
    total: number;
    page: number;
    totalPages: number;
  };
  outgoing: {
    items: StudyRequestDTO[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface PublicReviewDTO {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  learnerName: string;
}

export interface PublicPeerReviewsResult {
  reviews: PublicReviewDTO[];
  total: number;
  page: number;
  totalPages: number;
}

/** Statuses in which an accepted helper's contact is available to the learner. */
export function isContactUnlockedStatus(status: RequestStatus): boolean {
  return status === "ACCEPTED" || status === "COMPLETED" || status === "REVIEWED";
}

/**
 * Internal private helper that resolves contact given verified ObjectId.
 * Kept private to protect against caller-supplied ID spoofing.
 */
async function resolveRequestContactInternal(
  requestId: string,
  userObjectId: mongoose.Types.ObjectId
): Promise<SafeUnlockedContact | null> {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return null;
  }

  await connectToDatabase();
  const request = await StudyRequest.findById(requestId).lean();
  if (!request) {
    return null;
  }

  const currentUserIdStr = userObjectId.toString();
  const learnerId = request.learner.toString();
  const peerId = request.peer.toString();

  const isLearner = currentUserIdStr === learnerId;
  const isPeer = currentUserIdStr === peerId;

  if (!isLearner && !isPeer) {
    // Unrelated user: strictly forbidden
    return null;
  }

  // Learner can ONLY access contact if request is ACCEPTED, COMPLETED, or REVIEWED
  if (isLearner) {
    if (!isContactUnlockedStatus(request.status)) {
      return null;
    }
  }

  // Fetch peer's private contact and email
  const peerUser = await User.findById(peerId)
    .select("+contact +email")
    .lean();

  if (!peerUser) {
    return null;
  }

  return buildSafeUnlockedContact(peerUser);
}

/**
 * Public service to resolve unlocked contact details for a study request.
 * Strictly resolves identity through requireAuth() to prevent actor spoofing.
 */
export async function getAuthorizedRequestContact(
  requestId: string
): Promise<SafeUnlockedContact | null> {
  const authContext = await requireAuth();
  return resolveRequestContactInternal(requestId, authContext.user._id as mongoose.Types.ObjectId);
}

/**
 * Loads incoming and outgoing study requests for the authenticated user's dashboard.
 * Strictly resolves identity through requireAuth().
 * Stable sorting with _id tie-breaker.
 */
export async function getDashboardRequests(
  incomingPage = 1,
  outgoingPage = 1,
  pageSize = 10,
  options: { status?: RequestStatus; archived?: boolean } = {}
): Promise<DashboardRequestsResult> {
  const authContext = await requireAuth();
  const userObjectId = authContext.user._id as mongoose.Types.ObjectId;
  const userIdStr = userObjectId.toString();

  if (!isDatabaseConfigured()) {
    return {
      incoming: { items: [], total: 0, page: 1, totalPages: 1 },
      outgoing: { items: [], total: 0, page: 1, totalPages: 1 },
    };
  }

  await connectToDatabase();

  const boundedPageSize = Math.max(1, Math.min(pageSize, 50));
  const parsedIncoming = typeof incomingPage === "number" ? incomingPage : parseInt(String(incomingPage || "1"), 10);
  const safeIncoming = Math.max(1, Math.min(isNaN(parsedIncoming) ? 1 : parsedIncoming, 10000));
  const parsedOutgoing = typeof outgoingPage === "number" ? outgoingPage : parseInt(String(outgoingPage || "1"), 10);
  const safeOutgoing = Math.max(1, Math.min(isNaN(parsedOutgoing) ? 1 : parsedOutgoing, 10000));

  const allowedStatuses = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "REVIEWED"];
  const filters = {
    archivedBy: options.archived ? userObjectId : { $ne: userObjectId },
    ...(options.status && allowedStatuses.includes(options.status) ? { status: options.status } : {}),
  };
  // 1. Fetch incoming requests (current user is peer) with stable sort & _id tie-breaker
  const incomingTotal = await StudyRequest.countDocuments({ peer: userObjectId, ...filters });
  const incomingTotalPages = Math.max(1, Math.ceil(incomingTotal / boundedPageSize));
  const validIncomingPage = Math.min(safeIncoming, incomingTotalPages);
  const incomingSkip = (validIncomingPage - 1) * boundedPageSize;

  const rawIncoming = await StudyRequest.find({ peer: userObjectId, ...filters })
    .populate("learner", "name image university")
    .sort({ createdAt: -1, _id: -1 })
    .skip(incomingSkip)
    .limit(boundedPageSize)
    .lean();

  // 2. Fetch outgoing requests (current user is learner) with stable sort & _id tie-breaker
  const outgoingTotal = await StudyRequest.countDocuments({ learner: userObjectId, ...filters });
  const outgoingTotalPages = Math.max(1, Math.ceil(outgoingTotal / boundedPageSize));
  const validOutgoingPage = Math.min(safeOutgoing, outgoingTotalPages);
  const outgoingSkip = (validOutgoingPage - 1) * boundedPageSize;

  const rawOutgoing = await StudyRequest.find({ learner: userObjectId, ...filters })
    .populate("peer", "name image university")
    .sort({ createdAt: -1, _id: -1 })
    .skip(outgoingSkip)
    .limit(boundedPageSize)
    .lean();

  // 3. Transform incoming items (peer view)
  const incomingItems: StudyRequestDTO[] = (rawIncoming as unknown as RawPopulatedStudyRequest[]).map((req) => ({
    id: req._id.toString(),
    learner: {
      id: req.learner?._id ? req.learner._id.toString() : "",
      name: req.learner?.name || "Student Learner",
      image: req.learner?.image,
      university: req.learner?.university,
    },
    peer: {
      id: userIdStr,
      name: "You",
    },
    topic: req.topic,
    problemDescription: req.problemDescription,
    mode: req.mode,
    status: req.status,
    respondedAt: req.respondedAt ? new Date(req.respondedAt).toISOString() : null,
    learnerConfirmedAt: req.learnerConfirmedAt ? new Date(req.learnerConfirmedAt).toISOString() : null,
    peerConfirmedAt: req.peerConfirmedAt ? new Date(req.peerConfirmedAt).toISOString() : null,
    review: req.review
      ? {
          rating: req.review.rating,
          comment: req.review.comment,
          createdAt: req.review.createdAt ? new Date(req.review.createdAt).toISOString() : new Date().toISOString(),
        }
      : null,
    createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: req.updatedAt ? new Date(req.updatedAt).toISOString() : new Date().toISOString(),
    unlockedContact: null,
  }));

  // 4. Transform outgoing items (learner view). Contact unlocks only for the learner of
  // ACCEPTED/COMPLETED/REVIEWED requests. Every row here was loaded with
  // `learner: userObjectId`, so participant authorization is already enforced by the
  // query; peer contacts are then resolved in one batched lookup instead of per row.
  const rawOutgoingRows = rawOutgoing as unknown as RawPopulatedStudyRequest[];
  const unlockedPeerIds = Array.from(new Set(
    rawOutgoingRows
      .filter((req) => isContactUnlockedStatus(req.status) && req.peer?._id)
      .map((req) => req.peer!._id!.toString())
  ));
  const contactByPeer = new Map<string, SafeUnlockedContact>();
  if (unlockedPeerIds.length > 0) {
    const peers = await User.find({ _id: { $in: unlockedPeerIds } })
      .select("+contact +email")
      .lean();
    for (const peerUser of peers) {
      contactByPeer.set(peerUser._id.toString(), buildSafeUnlockedContact(peerUser));
    }
  }

  const outgoingItems: StudyRequestDTO[] = rawOutgoingRows.map((req) => {
      const peerIdStr = req.peer?._id ? req.peer._id.toString() : "";
      const unlockedContact: SafeUnlockedContact | null =
        isContactUnlockedStatus(req.status) ? contactByPeer.get(peerIdStr) ?? null : null;

      return {
        id: req._id.toString(),
        learner: {
          id: userIdStr,
          name: "You",
        },
        peer: {
          id: req.peer?._id ? req.peer._id.toString() : "",
          name: req.peer?.name || "Peer Helper",
          image: req.peer?.image,
          university: req.peer?.university,
        },
        topic: req.topic,
        problemDescription: req.problemDescription,
        mode: req.mode,
        status: req.status,
        respondedAt: req.respondedAt ? new Date(req.respondedAt).toISOString() : null,
        learnerConfirmedAt: req.learnerConfirmedAt ? new Date(req.learnerConfirmedAt).toISOString() : null,
        peerConfirmedAt: req.peerConfirmedAt ? new Date(req.peerConfirmedAt).toISOString() : null,
        review: req.review
          ? {
              rating: req.review.rating,
              comment: req.review.comment,
              createdAt: req.review.createdAt ? new Date(req.review.createdAt).toISOString() : new Date().toISOString(),
            }
          : null,
        createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: req.updatedAt ? new Date(req.updatedAt).toISOString() : new Date().toISOString(),
        unlockedContact,
      };
    });

  return {
    incoming: {
      items: incomingItems,
      total: incomingTotal,
      page: validIncomingPage,
      totalPages: incomingTotalPages,
    },
    outgoing: {
      items: outgoingItems,
      total: outgoingTotal,
      page: validOutgoingPage,
      totalPages: outgoingTotalPages,
    },
  };
}

/**
 * Public service to retrieve paginated public reviews for a peer.
 * Uses a safe public DTO that strictly excludes email, private contact, and problem descriptions.
 */
export async function getPublicPeerReviews(
  peerId: string,
  page = 1,
  pageSize = 5
): Promise<PublicPeerReviewsResult> {
  if (!mongoose.Types.ObjectId.isValid(peerId) || !isDatabaseConfigured()) {
    return { reviews: [], total: 0, page: 1, totalPages: 1 };
  }

  await connectToDatabase();
  const peerObjectId = new mongoose.Types.ObjectId(peerId);

  const boundedPageSize = Math.max(1, Math.min(pageSize, 50));
  const parsedPage = typeof page === "number" ? page : parseInt(String(page || "1"), 10);
  const safePage = Math.max(1, Math.min(isNaN(parsedPage) ? 1 : parsedPage, 10000));

  // Only genuine 1–5 integer ratings are shown; records without a rating are excluded
  // rather than displayed with an invented default.
  const query = {
    peer: peerObjectId,
    status: "REVIEWED" as const,
    "review.rating": { $gte: 1, $lte: 5 },
  };

  const total = await StudyRequest.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(total / boundedPageSize));
  const validPage = Math.min(safePage, totalPages);
  const skip = (validPage - 1) * boundedPageSize;

  const rawReviewed = await StudyRequest.find(query)
    .populate("learner", "name")
    .sort({ "review.createdAt": -1, _id: -1 })
    .skip(skip)
    .limit(boundedPageSize)
    .lean();

  const reviews: PublicReviewDTO[] = (rawReviewed as unknown as RawPopulatedStudyRequest[]).flatMap((req) => {
    const rating = req.review?.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return [];
    // First name plus last initial; a neutral fallback that does not claim verification.
    const rawName = req.learner?.name?.trim() || "Student";
    const nameParts = rawName.split(/\s+/);
    const safeLearnerName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : rawName;

    return [{
      id: req._id.toString(),
      rating,
      comment: req.review?.comment || "",
      createdAt: req.review?.createdAt
        ? new Date(req.review.createdAt).toISOString()
        : new Date().toISOString(),
      learnerName: safeLearnerName,
    }];
  });

  return {
    reviews,
    total,
    page: validPage,
    totalPages,
  };
}
