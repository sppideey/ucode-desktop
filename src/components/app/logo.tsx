import { cn } from "@/lib/utils";

/** ucode's mark: an iOS-style squircle in system blue with a rounded white u. Same drawing as app/icon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn("inline-block size-6 shrink-0", className)}>
      <defs>
        <linearGradient id="ucode-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4aa3ff" />
          <stop offset="1" stopColor="#0060df" />
        </linearGradient>
        <linearGradient id="ucode-logo-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="23" fill="url(#ucode-logo-bg)" />
      <rect width="100" height="100" rx="23" fill="url(#ucode-logo-shine)" />
      <path d="M33 31v20a17 17 0 0 0 34 0V31" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="67" cy="73" r="5.5" fill="#fff" />
    </svg>
  );
}
