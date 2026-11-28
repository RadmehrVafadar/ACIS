# Interview studio

Use charcoal-blue surfaces and a muted lilac accent for the primary action and selected controls.
The light theme uses the same hierarchy with pale gray surfaces and dark violet accents.
The rotating ASCII folded A is centered above the catalog at half its width, with a 4:3 frame on desktop and phone.
The Daily has a compact placeholder card above the exercise list.
The library groups connection status, theme, and help in a floating pill at the upper right.
Select the mark to pause or resume rotation.
Reduced motion shows the front face.
The workbench uses the folded A as its home control.
Use Keyline’s duotone icons for studio controls and the filled set for exercise covers.
Each bundled exercise has a recognizable subject glyph, a topic label, and a distinct paper color with dark ink.
Add shared interactive components from shadcn/ui to `web/src/components/ui` and use the studio theme tokens for their colors.

The studio bundles Bricolage Grotesque locally, using heavier weights for headings and exercise titles and regular weight for reading.
The desktop library places its two-line masthead and recent attempts in a left column beside the exercise collection.
Each history entry leads with the exercise name and places the stack on the left and status on the right of the second line.
In unfinished entries, align the quiet **Stop** action with the title at the right edge.
The creation time and replay seed are available in the entry tooltip.
The first matching exercise spans the collection with its full paper color.
The remaining exercises sit in pairs on neutral surfaces, with a compact paper cover to the left of each brief.
Place the subject glyph above its topic at every screen size, and align stack and duration beneath the description.
Phones get a single column with a visible resume action above the catalog.
Exercise arrows shift on hover or keyboard focus when motion is enabled.
The exercise list briefly fades and slides into place when its visible results change.
The exercise brief and its start or resume action share one screen.
The interview opens with Question on the left, Editor in the center, and AI Assistant on the right.
Each pane has its own tab strip, and tabs can move between panes.
Use the studio accent for the selected underline, the insertion line when docking a tab, and the divider under the pointer or keyboard focus.
Dividers follow the pointer directly.
Below 720 pixels, show one full-width view with a switcher for all six tabs.
The workbench underline follows the selected view within its pane, and menus and dialogs ease into place when opened.
The system’s reduced-motion setting removes this movement.
Use status text alongside color and keep a visible keyboard focus indicator.
