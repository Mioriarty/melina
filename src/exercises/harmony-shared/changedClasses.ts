/**
 * The notes a corrected setting had to change, drawn in the accent colour.
 *
 * `satbMei` marks them `@type="changed"`, which Verovio copies into the
 * rendered element's `class`. Two properties, because a note is drawn two
 * ways: a stem is *stroked* in `currentColor`, so `color` reaches it, while a
 * notehead or an accidental is a filled glyph with no fill of its own, so it
 * inherits `fill` from the group. Setting only one colours half the note.
 */
export const CHANGED_NOTE = '[&_.changed]:fill-accent [&_.changed]:text-accent'
