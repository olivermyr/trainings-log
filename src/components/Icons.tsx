import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: P) => (
  <Base {...p}>
    <path d="M6.5 8.5v7M17.5 8.5v7M3.5 10.5v3M20.5 10.5v3M6.5 12h11" />
  </Base>
);

export const IconHistory = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Base>
);

export const IconProgress = (p: P) => (
  <Base {...p}>
    <path d="M4 19.5h16" />
    <path d="M7 16v-4M12 16V8M17 16V5" />
  </Base>
);

export const IconProfile = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" />
  </Base>
);

export const IconChevronRight = (p: P) => (
  <Base size={16} strokeWidth={2} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
);

export const IconChevronLeft = (p: P) => (
  <Base size={22} strokeWidth={2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const IconMoon = (p: P) => (
  <Base {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
  </Base>
);

export const IconChevronDown = (p: P) => (
  <Base size={24} strokeWidth={2} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);
