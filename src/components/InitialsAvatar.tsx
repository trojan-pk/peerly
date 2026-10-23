interface InitialsAvatarProps {
  name?: string | null;
  className?: string;
  decorative?: boolean;
}

export function InitialsAvatar({ name, className = "", decorative = true }: InitialsAvatarProps) {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = (words.length > 1
    ? `${Array.from(words[0])[0]}${Array.from(words.at(-1)!)[0]}`
    : Array.from(words[0] || "Student").slice(0, 2).join("")
  ).toUpperCase();

  return <span
    className={`initials-avatar ${className}`}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : `${name || "Student"} avatar`}
    aria-hidden={decorative ? true : undefined}
  >{initials}</span>;
}
