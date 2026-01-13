// Time constants
export const DAYS_MS = 24 * 60 * 60 * 1000;

// Legacy ELO constants (to be removed after migration)
export const NEW_ITEM_THRESHOLD = 5;
export const CLOSE_RATING_RANGE = 100;

// Glicko-2 Parameters
export const GLICKO_DEFAULT_RATING = 1500;
export const GLICKO_DEFAULT_RD = 350;
export const GLICKO_DEFAULT_VOLATILITY = 0.06;
export const GLICKO_TAU = 0.5;
export const GLICKO_SCALING_FACTOR = 173.7178;

// Confidence Thresholds
export const RD_CONFIDENCE_THRESHOLD = 200; // Items with RD > this are "unranked"

// RD Decay
export const RD_DECAY_PER_DAY = 5; // RD increase per day without comparison

// Comparison Scheduling
export const COMPARISON_RESURFACE_DAYS_NEW = 1; // Days before new item resurfaces
export const COMPARISON_RESURFACE_DAYS_ESTABLISHED = 3; // Days for established items

// UI Thresholds
export const UNRANKED_NOTIFICATION_THRESHOLD = 3; // Show badge when this many unranked

// Archival
export const COMPARISON_RETENTION_DAYS = 90;
