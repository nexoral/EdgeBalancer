// Minimal icon set — 1.5px strokes, 20px default
interface IconProps {
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const Icon = ({
  d,
  size = 16,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 1.5,
  children,
  style
}: IconProps & { d?: string; children?: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d && <path d={d} />}
    {children}
  </svg>
);

export const Icons = {
  Arrow: (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>,
  Check: (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>,
  Plus: (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  X: (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>,
  Menu: (p: IconProps) => <Icon {...p}><path d="M3 7h18M3 12h18M3 17h18" /></Icon>,
  Key: (p: IconProps) => <Icon {...p}><circle cx="8" cy="15" r="4" /><path d="m10.85 12.15 7.15-7.15M16 8l2 2M13 11l2 2" /></Icon>,
  Link: (p: IconProps) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>,
  Server: (p: IconProps) => <Icon {...p}><rect x="2" y="3" width="20" height="8" rx="1" /><rect x="2" y="13" width="20" height="8" rx="1" /><path d="M6 7h.01M6 17h.01" /></Icon>,
  Globe: (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></Icon>,
  Zap: (p: IconProps) => <Icon {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></Icon>,
  Shield: (p: IconProps) => <Icon {...p}><path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5l-8-3Z" /></Icon>,
  Layers: (p: IconProps) => <Icon {...p}><path d="m12 2 10 6-10 6L2 8l10-6Z" /><path d="m2 14 10 6 10-6M2 18l10 6 10-6" /></Icon>,
  Grid: (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Icon>,
  Trash: (p: IconProps) => <Icon {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icon>,
  Copy: (p: IconProps) => <Icon {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>,
  Eye: (p: IconProps) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>,
  EyeOff: (p: IconProps) => <Icon {...p}><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A11 11 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20" /></Icon>,
  Settings: (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Icon>,
  Log: (p: IconProps) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6 M9 9h1" /></Icon>,
  Activity: (p: IconProps) => <Icon {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Icon>,
  Refresh: (p: IconProps) => <Icon {...p}><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Icon>,
  MoreV: (p: IconProps) => <Icon {...p}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></Icon>,
  Logout: (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>,
  Search: (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>,
  Flow: (p: IconProps) => <Icon {...p}><circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 11 17 6M7 13l10 5" /></Icon>,
  Lock: (p: IconProps) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>,
  Cloud: (p: IconProps) => <Icon {...p}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></Icon>,
  Edit: (p: IconProps) => <Icon {...p}><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></Icon>,
  ChevronDown: (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>,
  Book: (p: IconProps) => <Icon {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13M20 17V6a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 6v11.5" /></Icon>,
  Mail: (p: IconProps) => <Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></Icon>,
  History: (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></Icon>,
  Download: (p: IconProps) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>,
};
