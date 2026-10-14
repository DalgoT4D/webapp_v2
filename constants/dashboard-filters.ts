// Stable reference for callers that don't pass dependentGroupFilterIds -- a fresh `[]`
// default would be a new array on every render, re-triggering the sync effect below.
export const EMPTY_DEPENDENT_GROUP_FILTER_IDS: number[] = [];

// Backend caps at the same number, most frequent first.
export const FILTER_OPTIONS_LIMIT = 100;
