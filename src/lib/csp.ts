/**
 * Content-Security-Policy for HTML responses.
 * - Scripts: only same-origin files plus inline scripts carrying this request's nonce
 *   ('strict-dynamic' lets those trusted scripts load Next.js chunks). No 'unsafe-eval'
 *   outside development, no 'unsafe-inline' for scripts.
 * - Styles allow inline attributes because React/Motion render style props; style
 *   injection cannot execute code.
 * - frame-ancestors 'none' blocks clickjacking; form-action allows the Google sign-in hop.
 */
export function buildCsp(nonce: string, options: { dev?: boolean; https?: boolean } = {}): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function isHttpsDeployment(): boolean {
  try {
    return new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").protocol === "https:";
  } catch {
    return false;
  }
}
