export const theme = {
  colors: {
    background: '#0A0A10',
    surface: '#13131C',
    surfaceAlt: '#1C1C2A',
    accent: '#6C63FF',      // electric indigo - primary
    accentDown: '#FF6584',  // hot pink - beat 1 / playing state
    text: '#F2F2F7',
    textDim: '#64647A',
    success: '#4ECDC4',     // teal
    error: '#FF6584',
    border: '#2A2A3A',
  },
  borderRadius: {
    sm: 12,
    lg: 20,
  },
  fontSize: {
    display: 72,
    h1: 32,
    h2: 22,
    body: 16,
    caption: 13,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
} as const;

export type Theme = typeof theme;
