/**
 * Small monochrome inline icons for the link-button row and nav (wave 12).
 * Inline SVGs, not an icon dependency — lucide-react was dropped in wave 6
 * and these five are the site's whole icon vocabulary. All decorative
 * (aria-hidden): every usage pairs them with visible text.
 */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5L14 3Z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M9 12.5h6M9 16h6" />
    </svg>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 2.5-.35c.85 0 1.7.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.28 10.28 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg {...base} fill="currentColor" stroke="none" className={className}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

export function HuggingFaceIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 9.4v1.4M15.6 9.4v1.4" strokeWidth="2.1" />
      <path d="M8 13.4c1 2.1 2.4 3.1 4 3.1s3-1 4-3.1" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.8" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
