/**
 * The box an engraved staff is drawn in, shared by every exercise that draws
 * one.
 *
 * **The staff is bounded by the room left for it, not by a slice of the
 * viewport.** `max-h-[Ndvh]` on its own cannot know how much room there is:
 * the prompt above and the feedback below take what they take, and on a screen
 * where the remainder came out under that fraction the notation overflowed and
 * the Next button was drawn across it.
 *
 * So the height comes down the flex chain instead. `h-full` is the
 * load-bearing part — it gives this box a definite height from the row around
 * it, which is what lets the SVG's own `max-h-full` mean anything. Without it
 * the box sizes to the drawing and the drawing to the box, and nothing is
 * bounded at all. Every ancestor needs `min-h-0` to be allowed to shrink, and
 * the row needs `items-stretch` so this box is given the height rather than
 * being centred at its content's.
 *
 * The viewport fraction stays only as a ceiling, to stop the notation
 * dominating a tall screen where there is room to spare.
 */
export const SCORE_BOX = 'h-full max-h-[30dvh] min-h-0 flex-1'

/**
 * The same box, for notation that is several systems tall.
 *
 * Melodic dictation draws one bar per system, so a two-bar phrase is two
 * staves stacked and a comparison is four. At `SCORE_BOX`'s ceiling those come
 * out around half the height a single staff gets, which is the wrong way round:
 * the phrase is *more* to read, not less. The extra viewport fraction comes out
 * of room the keyboard was not using — its own cap is what bounds it from below
 * — and the flex chain still decides the real height, so on a short screen this
 * is no different from `SCORE_BOX`.
 */
export const PHRASE_SCORE_BOX = 'h-full max-h-[40dvh] min-h-0 flex-1'
