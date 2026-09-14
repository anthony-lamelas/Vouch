/**
 * Shared class strings for controls that are sometimes a <button>, sometimes an <a>. Kept out
 * of the component files so those export only components (fast refresh).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-graphite text-primary-fg border-graphite hover:bg-carbon hover:border-carbon disabled:bg-caption disabled:border-caption',
  secondary:
    'bg-canvas text-ink border-line hover:bg-paper disabled:text-caption disabled:hover:bg-canvas',
  ghost:
    'bg-transparent text-carbon border-transparent hover:bg-haze hover:text-ink disabled:text-caption disabled:hover:bg-transparent',
  danger:
    'bg-canvas text-no-text border-line hover:bg-no-bg disabled:text-caption disabled:hover:bg-canvas',
};

/** 32px inside tables and toolbars, 36px everywhere else. */
const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-3 text-[14px]',
};

export function buttonClass(variant: ButtonVariant, size: ButtonSize, extra = ''): string {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control border font-medium transition-colors ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${extra}`;
}

/** Outlined 22px chip; `on` fills it ice/cobalt. */
export function chipClass(on: boolean): string {
  return `inline-flex h-7 max-w-full items-center rounded-tag border px-2.5 text-[13.5px] font-medium tracking-normal whitespace-nowrap ${
    on ? 'border-ice bg-ice text-cobalt' : 'border-line bg-canvas text-carbon'
  }`;
}

/** Linear-style filter pill: "+ Company", or a toggle that fills when on. */
export function filterPillClass(on: boolean): string {
  return `inline-flex h-8 items-center gap-1 rounded-tag border px-2.5 text-[14px] font-medium tracking-normal transition-colors ${
    on
      ? 'border-ice bg-ice text-cobalt'
      : 'border-line bg-canvas text-carbon hover:border-caption hover:text-ink'
  }`;
}
