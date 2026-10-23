export interface SafeUnlockedContact {
  preferredMethod: "whatsapp" | "meeting_link" | "email" | "unspecified";
  whatsapp?: string;
  whatsappUrl?: string;
  meetingLink?: string;
  email?: string;
  unavailable?: boolean;
  message?: string;
}

/**
 * Constructs a safe unlocked contact payload according to platform privacy rules:
 * - Validates WhatsApp numbers (digits only, 7-15 length) and builds safe wa.me links.
 * - Validates meeting links (HTTP/HTTPS only via new URL parsing).
 * - NEVER exposes the peer's email unless email is explicitly set as preferredMethod.
 * - Returns an honest unavailable state if no contact channels are configured.
 */
export function buildSafeUnlockedContact(peerUser: {
  email?: string;
  contact?: {
    whatsapp?: string;
    meetingLink?: string;
    preferredMethod?: string;
  };
}): SafeUnlockedContact {
  const contact = peerUser.contact || {};
  const preferredMethod =
    (contact.preferredMethod as SafeUnlockedContact["preferredMethod"]) || "unspecified";

  let whatsapp: string | undefined = undefined;
  let whatsappUrl: string | undefined = undefined;
  let meetingLink: string | undefined = undefined;
  let email: string | undefined = undefined;

  // 1. WhatsApp parsing & safe link construction
  if (contact.whatsapp && contact.whatsapp.trim().length > 0) {
    const rawWa = contact.whatsapp.trim();
    // Only permit digits in wa.me URL
    const digitsOnly = rawWa.replace(/[^\d]/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      whatsapp = rawWa;
      whatsappUrl = `https://wa.me/${digitsOnly}`;
    }
  }

  // 2. Meeting Link parsing (strictly HTTP/HTTPS)
  if (contact.meetingLink && contact.meetingLink.trim().length > 0) {
    try {
      const parsed = new URL(contact.meetingLink.trim());
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) {
        meetingLink = parsed.href;
      }
    } catch {
      // Ignored if invalid URL
    }
  }

  // 3. Email disclosure: ONLY if email is the explicitly chosen preferred contact method!
  if (preferredMethod === "email" && peerUser.email && peerUser.email.trim().length > 0) {
    email = peerUser.email.trim();
  }

  const hasAnyContact = Boolean(whatsapp || meetingLink || email);

  if (!hasAnyContact) {
    return {
      preferredMethod,
      unavailable: true,
      message: "The peer has not yet configured private contact details.",
    };
  }

  return {
    preferredMethod,
    whatsapp,
    whatsappUrl,
    meetingLink,
    email,
  };
}
