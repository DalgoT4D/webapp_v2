// PDF Export Constants
// Used in the client-side PDF generation pipeline (handleDownload)

// Width of the off-screen DOM clone in pixels (controls the layout width for the screenshot)
export const PDF_CLONE_WIDTH_PX = 1200;

// Padding around the cloned content in pixels
export const PDF_CLONE_PADDING_PX = 32;

// Margin below the cloned header in pixels
export const PDF_HEADER_MARGIN_BOTTOM_PX = 16;

// Delay in ms before html2canvas captures the cloned DOM.
// The clone needs time to settle after being appended to the document.
// Too short = charts render blank; too long = slower export. 500ms is reliable in testing.
export const PDF_RENDER_DELAY_MS = 500;

// html2canvas scale factor. 3x produces sharp text/charts on retina displays.
// 2x was blurry; 4x would use excessive memory.
export const PDF_CANVAS_SCALE = 3;

// PDF page margin in points (pt). Provides breathing room around the content.
export const PDF_PAGE_MARGIN_PT = 20;

// A4 page width in points. Standard A4 = 595.28pt wide.
// We keep A4 width for readability but use a custom height to fit all content.
export const PDF_A4_WIDTH_PT = 595.28;

// JPEG quality for the screenshot image embedded in the PDF.
// 1.0 = maximum quality, no compression artifacts. Preserves chart colors.
export const PDF_JPEG_QUALITY = 1.0;
