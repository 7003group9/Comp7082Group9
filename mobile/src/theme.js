// Shared design tokens so every screen uses the same look (dark theme).

// Colour palette.
export const colors = {
  mist: '#0F1419', // screen background
  paper: '#1A2129', // cards and inputs
  ink: '#E6EDF3', // main text
  slate: '#8B98A5', // secondary text, input borders
  teal: '#2DD4BF', // accent: buttons, links, selected chips
  tealDark: '#14B8A6', // accent while pressed
  onAccent: '#04201C', // text on accent (and danger) buttons and selected chips
  chipBorder: '#3A4654', // outline of an unselected chip
  danger: '#F87171', // errors, delete, required *
  warning: '#FBBF24',
  line: '#2D3742', // dividers and card borders
  shadow: '#000000',
  placeholder: '#5C6773', // hint text in empty inputs, dimmer than typed text
  // Badges and highlights: a tinted background with bright text.
  tag: '#3A2A12', tagText: '#FBBF24', // claim pending
  tagDone: '#13361F', tagDoneText: '#4ADE80', // claimed / approved
  tagWait: '#3D2614', tagWaitText: '#FB923C', // your claim is pending
  tagNo: '#3B1518', tagNoText: '#F87171', // your claim wasn't approved
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

// Styles used on several screens. Use them directly, e.g. style={[ui.button, busy && ui.disabled]},
// or spread them to add spacing: { ...ui.input, marginBottom: spacing.md }.
export const ui = {
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.slate,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  button: { backgroundColor: colors.teal, padding: spacing.md, borderRadius: 8, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.onAccent },
  disabled: { opacity: 0.6 },
  card: { backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  // Small filled button, a compact version of "I found something"; add ui.pressed while pressed.
  smallButton: { backgroundColor: colors.teal, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  smallButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: '700' },
  pressed: { backgroundColor: colors.tealDark },
};
