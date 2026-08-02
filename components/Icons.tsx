import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const MenuIcon = (props: IconProps) => <svg {...base} {...props}><path d="M4 7h16M4 12h16M4 17h10" /></svg>;
export const ChartIcon = (props: IconProps) => <svg {...base} {...props}><path d="M5 20V10m7 10V4m7 16v-7" /></svg>;
export const HelpIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.1-2.5 4M12 17.5h.01" /></svg>;
export const PlayIcon = (props: IconProps) => <svg {...base} {...props}><path fill="currentColor" stroke="none" d="m8 5 11 7-11 7Z" /></svg>;
export const StopIcon = (props: IconProps) => <svg {...base} {...props}><rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" stroke="none" /></svg>;
export const SearchIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
export const ChevronIcon = (props: IconProps) => <svg {...base} {...props}><path d="m9 18 6-6-6-6" /></svg>;
export const CloseIcon = (props: IconProps) => <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
export const ShareIcon = (props: IconProps) => <svg {...base} {...props}><circle cx="18" cy="5" r="2.2" /><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="19" r="2.2" /><path d="m8 11 8-5M8 13l8 5" /></svg>;
export const HeadphonesIcon = (props: IconProps) => <svg {...base} {...props}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z" /></svg>;
export const VolumeIcon = (props: IconProps) => <svg {...base} {...props}><path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Zm4 4a4 4 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11" /></svg>;
export const CheckIcon = (props: IconProps) => <svg {...base} {...props}><path d="m5 12 4.5 4.5L19 7" /></svg>;
export const SparkIcon = (props: IconProps) => <svg {...base} {...props}><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></svg>;
export const ArrowIcon = (props: IconProps) => <svg {...base} {...props}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
export const CalendarIcon = (props: IconProps) => <svg {...base} {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>;

