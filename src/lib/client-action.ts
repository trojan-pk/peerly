export interface ActionFeedback {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  conflict?: boolean;
  rateLimited?: boolean;
  requestId?: string;
  resourceId?: string;
  isComplete?: boolean;
}

/** Preserve form input and show a retry message if a server action cannot be reached. */
export async function safeAction(action: () => Promise<ActionFeedback>): Promise<ActionFeedback> {
  try { return await action(); }
  catch { return { success: false, message: "We couldn't reach the server. Your changes have not been confirmed. Please try again." }; }
}
