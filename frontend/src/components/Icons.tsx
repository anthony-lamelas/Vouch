import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

/** 16px, 1.5px stroke, monochrome. Every icon in the app comes through here. */
function Svg({ size = 16, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    />
  );
}

export function BriefcaseIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4.5" width="12" height="9" rx="1.5" />
      <path d="M5.5 4.5V3.25C5.5 2.56 6.06 2 6.75 2h2.5c.69 0 1.25.56 1.25 1.25V4.5M2 8.25h12" />
    </Svg>
  );
}

export function PipelineIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="2.5" width="3.3" height="11" rx="1" />
      <rect x="6.35" y="2.5" width="3.3" height="7.5" rx="1" />
      <rect x="10.7" y="2.5" width="3.3" height="5" rx="1" />
    </Svg>
  );
}

export function PlusIcon(props: Props) {
  return (
    <Svg size={12} {...props}>
      <path d="M8 3v10M3 8h10" />
    </Svg>
  );
}

export function XIcon(props: Props) {
  return (
    <Svg size={12} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Svg>
  );
}

export function ChevronIcon(props: Props) {
  return (
    <Svg size={12} {...props}>
      <path d="M6 3.5L10.5 8 6 12.5" />
    </Svg>
  );
}

export function SunIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.24 1.24M11.36 11.36l1.24 1.24M3.4 12.6l1.24-1.24M11.36 4.64l1.24-1.24" />
    </Svg>
  );
}

export function MoonIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" />
    </Svg>
  );
}

export function ExternalIcon(props: Props) {
  return (
    <Svg size={12} {...props}>
      <path d="M6.5 3.5H3.5v9h9V9.5M9.5 3h3.5v3.5M13 3L7.5 8.5" />
    </Svg>
  );
}
