## Plan: Aesthetic Refresh for the Playbook Page and the rest of the pages

### Current State

The playbook page is functional but visually flat — plain cards with minimal hierarchy, no visual warmth, and the dark mode feels stark. The header is minimal and the empty/loading states are basic.

### Proposed Improvements

**1. Header Enhancement**

- Add a subtle gradient or branded accent to the header area
- Include a short tagline/subtitle under "Knowledge Hub" (e.g., "Your team's resolution playbook")
- Slightly larger logo area with a small icon beside the title

**2. Playbook Cards Visual Upgrade**

- Add a subtle left border accent color per category (color-coded)
- Slightly softer card backgrounds with a gentle gradient (`bg-gradient-to-br from-card to-card/80`)
- Better spacing and visual hierarchy — larger title, more breathing room
- Add a subtle hover lift effect (`hover:-translate-y-0.5 hover:shadow-lg transition-all`)
- Step numbers styled as small filled circles instead of plain monospace numbers

**3. Search Bar Polish**

- Rounded-full search input with a softer look
- Subtle background tint on the search area

**4. Empty & Loading States**

- Loading: replace plain text with a skeleton shimmer (3 placeholder card outlines)
- Empty state: add a soft illustration-style icon with warmer messaging

**5. Sidebar Cards (FAQ + Known Issues)**

- Slightly rounded corners and softer borders
- FAQ card: subtle blue gradient accent (already partially done, refine it)
- Known Issues card: warm amber glow border effect

**6. Tab Strip Polish**

- Add subtle pill-style active indicator with animation
- Slightly more padding and rounded corners on the tab strip

**7. Overall Page**

- Widen the max-width from `3xl` to `5xl` or `6xl` to give the sidebar layout more room
- Add a subtle dot-grid or gradient background pattern behind the content area

### Files to Change

- `src/index.css` — add subtle background pattern utility
- `src/pages/PublicPlaybook.tsx` — header styling, wider max-width
- `src/components/PlaybookView.tsx` — card styling, search bar, loading skeletons, hover effects
- `src/components/CategoryBadge.tsx` — category-specific color mapping for left borders
- `src/components/KnownIssuesBanner.tsx` — subtle glow styling
- `src/components/DynamicFAQ.tsx` — minor refinements

No database or backend changes needed. Purely visual/CSS.