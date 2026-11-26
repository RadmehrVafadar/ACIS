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
The creation time and replay seed are available in the entry tooltip.
The first matching exercise spans the collection with its full paper color.
The remaining exercises sit in pairs on neutral surfaces, with a compact paper cover to the left of each brief.
Place the subject glyph above its topic at every screen size, and align stack and duration beneath the description.
Phones get a single column with a visible resume action above the catalog.
Exercise arrows shift on hover or keyboard focus when motion is enabled.
The exercise list briefly fades and slides into place when its visible results change.
The exercise brief and its start or resume action share one screen.
During an interview, the editor takes the center and the question and assistant panes can be hidden.
The workbench underline follows the selected view, and menus and dialogs ease into place when opened.
The system’s reduced-motion setting removes this movement.
Use status text alongside color, keep a visible keyboard focus indicator, and let narrow screens stack content or open a side pane.
