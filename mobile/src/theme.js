// Shared design tokens so every screen uses the same look.
// Colour palette.
export const colors = {
  mist: '#E8EEF2',
  paper: '#FFFFFF',
  ink: '#16202B',
  slate: '#566676',
  teal: '#0B6E6E',
  tealDark: '#085757',
  tag: '#F4C542',
  line: '#C9D4DC',
};

// Spacing scale in px (use these instead of magic numbers).
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// Text styles: spread into a Text style, e.g. style={type.heading}.
export const type = {
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  heading: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, color: colors.ink },
  meta: { fontSize: 14, color: colors.slate },
};
