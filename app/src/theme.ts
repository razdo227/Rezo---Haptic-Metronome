export const theme = {
  colors: {
    background: '#05070D',
    surface: '#0D111A',
    surfaceAlt: '#151A24',
    accent: '#43B4FF',      // electric blue - primary
    accentDown: '#1E86C7',  // deeper blue for active states
    text: '#F2F2F7',
    textDim: '#9097A6',
    success: '#43B4FF',
    error: '#FF6B6B',
    border: '#252C3D',
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
