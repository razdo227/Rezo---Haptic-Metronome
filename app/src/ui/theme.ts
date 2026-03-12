export const colors = {
  background: '#0A0D12',
  backgroundElevated: '#10151D',
  panel: '#141B24',
  panelMuted: '#0F141B',
  border: '#232D39',
  borderStrong: '#324050',
  text: '#F3F6F8',
  textMuted: '#A0ACB9',
  textSubtle: '#7D8A98',
  accent: '#7C9EFF',
  accentStrong: '#5C84FF',
  accentMuted: '#1B2740',
  success: '#4CD6A8',
  danger: '#FF6B7A'
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999
} as const;

export const typography = {
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 1
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const
  },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.6
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const
  },
  metric: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.4
  },
  input: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.5
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const
  },
  chip: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.3
  }
} as const;
