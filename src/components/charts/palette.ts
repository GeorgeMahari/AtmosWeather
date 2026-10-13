/**
 * Categorical series colours, assigned in this fixed order. Validated for the
 * dark chart surface (lightness band, colour-vision-deficiency separation and
 * ≥3:1 contrast). Kept apart from the chart code so non-chart UI can reuse the
 * swatches without pulling in the charting library.
 */
export const SERIES_COLORS = ['#1f9fe0', '#d97706', '#8b5cf6', '#12a877'] as const
