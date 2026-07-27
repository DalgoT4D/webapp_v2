/**
 * Minimum rendered width of the source-grouped connection list.
 *
 * Below this the four columns (source details 30%, then connection name 45% /
 * last sync 35% / actions 20% of the remainder) squash until the connection
 * name and the sync status collide and the three action buttons wrap. Instead
 * of squashing, the list scrolls horizontally on narrow screens. The sticky
 * header row and the source rows share this value so their columns stay
 * aligned while scrolling.
 */
export const INGEST_LIST_MIN_WIDTH_CLASS = 'min-w-[960px]';
