/**
 * Glicko-2 Rating System Implementation
 *
 * Based on the algorithm described at http://www.glicko.net/glicko/glicko2.pdf
 * and the JavaScript implementation at https://github.com/mmai/glicko2js
 *
 * Converted to TypeScript for use in Convex backend.
 */

import {
  GLICKO_DEFAULT_RATING,
  GLICKO_DEFAULT_RD,
  GLICKO_DEFAULT_VOLATILITY,
  GLICKO_SCALING_FACTOR,
  GLICKO_TAU,
  RD_CONFIDENCE_THRESHOLD,
} from "./constants";

export interface RatingData {
  rating: number;
  rd: number;
  volatility: number;
}

export interface MatchResult {
  opponentRating: number;
  opponentRd: number;
  score: number; // 1 = win, 0 = loss, 0.5 = tie
}

/**
 * Convert from public rating (1500-based) to internal scale (0-based)
 */
function toInternalRating(rating: number): number {
  return (rating - GLICKO_DEFAULT_RATING) / GLICKO_SCALING_FACTOR;
}

/**
 * Convert from internal scale to public rating
 */
function toPublicRating(internalRating: number): number {
  return internalRating * GLICKO_SCALING_FACTOR + GLICKO_DEFAULT_RATING;
}

/**
 * Convert RD from public scale to internal scale
 */
function toInternalRd(rd: number): number {
  return rd / GLICKO_SCALING_FACTOR;
}

/**
 * Convert RD from internal scale to public scale
 */
function toPublicRd(internalRd: number): number {
  return internalRd * GLICKO_SCALING_FACTOR;
}

/**
 * The Glicko-2 g(RD) function - reduces the impact of games with uncertain opponents
 */
function g(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * rd * rd) / (Math.PI * Math.PI));
}

/**
 * The Glicko-2 E function - expected outcome against an opponent
 */
function E(rating: number, opponentRating: number, opponentRd: number): number {
  return 1 / (1 + Math.exp(-g(opponentRd) * (rating - opponentRating)));
}

/**
 * Calculate variance based on match outcomes (Step 3)
 */
function calculateVariance(
  rating: number,
  matches: { opponentRating: number; opponentRd: number }[],
): number {
  let sum = 0;
  for (const match of matches) {
    const gRd = g(match.opponentRd);
    const expectedScore = E(rating, match.opponentRating, match.opponentRd);
    sum += gRd * gRd * expectedScore * (1 - expectedScore);
  }
  return 1 / sum;
}

/**
 * Calculate delta - estimated improvement in rating (Step 4)
 */
function calculateDelta(
  rating: number,
  variance: number,
  matches: { opponentRating: number; opponentRd: number; score: number }[],
): number {
  let sum = 0;
  for (const match of matches) {
    const gRd = g(match.opponentRd);
    const expectedScore = E(rating, match.opponentRating, match.opponentRd);
    sum += gRd * (match.score - expectedScore);
  }
  return variance * sum;
}

/**
 * Calculate new volatility using the Illinois algorithm (Step 5)
 * This is the "newprocedure" from the reference implementation
 */
function calculateNewVolatility(
  volatility: number,
  rd: number,
  delta: number,
  variance: number,
  tau: number,
): number {
  const a = Math.log(volatility * volatility);
  const epsilon = 0.0000001;

  // Helper function f(x)
  const f = (x: number): number => {
    const expX = Math.exp(x);
    const rdSquared = rd * rd;
    const denominator = rdSquared + variance + expX;
    const deltaSquared = delta * delta;

    const term1 =
      (expX * (deltaSquared - rdSquared - variance - expX)) /
      (2 * denominator * denominator);
    const term2 = (x - a) / (tau * tau);

    return term1 - term2;
  };

  // Step 5.2: Set initial values of iterative algorithm
  let A = a;
  let B: number;

  if (delta * delta > rd * rd + variance) {
    B = Math.log(delta * delta - rd * rd - variance);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  // Step 5.3
  let fA = f(A);
  let fB = f(B);

  // Step 5.4: Iterate
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  // Step 5.5
  return Math.exp(A / 2);
}

/**
 * Update rating deviation before rating period (Step 6)
 * This increases RD to account for uncertainty over time
 */
function preRatingPeriodRd(rd: number, volatility: number): number {
  return Math.sqrt(rd * rd + volatility * volatility);
}

/**
 * Calculate new ratings after a series of matches in a rating period
 *
 * @param player - Current player rating data
 * @param matches - Array of match results from this rating period
 * @returns New rating data after processing all matches
 */
export function updateRating(
  player: RatingData,
  matches: MatchResult[],
): RatingData {
  // Convert to internal scale
  const internalRating = toInternalRating(player.rating);
  let internalRd = toInternalRd(player.rd);
  let volatility = player.volatility;

  // If no matches played, only apply RD increase (Step 6 only)
  if (matches.length === 0) {
    const newRd = preRatingPeriodRd(internalRd, volatility);
    return {
      rating: player.rating,
      rd: Math.min(toPublicRd(newRd), GLICKO_DEFAULT_RD), // Cap at default RD
      volatility,
    };
  }

  // Convert opponent data to internal scale
  const internalMatches = matches.map((m) => ({
    opponentRating: toInternalRating(m.opponentRating),
    opponentRd: toInternalRd(m.opponentRd),
    score: m.score,
  }));

  // Step 3: Calculate variance
  const variance = calculateVariance(internalRating, internalMatches);

  // Step 4: Calculate delta
  const delta = calculateDelta(internalRating, variance, internalMatches);

  // Step 5: Calculate new volatility
  volatility = calculateNewVolatility(
    volatility,
    internalRd,
    delta,
    variance,
    GLICKO_TAU,
  );

  // Step 6: Update RD to new pre-rating period value
  internalRd = preRatingPeriodRd(internalRd, volatility);

  // Step 7: Update rating and RD
  const newRdSquared = 1 / (1 / (internalRd * internalRd) + 1 / variance);
  const newRd = Math.sqrt(newRdSquared);

  let ratingChange = 0;
  for (const match of internalMatches) {
    const gRd = g(match.opponentRd);
    const expectedScore = E(internalRating, match.opponentRating, match.opponentRd);
    ratingChange += gRd * (match.score - expectedScore);
  }
  const newRating = internalRating + newRdSquared * ratingChange;

  // Step 8: Convert back to public scale
  return {
    rating: Math.round(toPublicRating(newRating)),
    rd: Math.round(toPublicRd(newRd)),
    volatility: Math.round(volatility * 1000000) / 1000000, // 6 decimal places
  };
}

/**
 * Process a single comparison and return new ratings for both items
 *
 * This is a convenience function for the common case of updating ratings
 * after a single pairwise comparison.
 *
 * @param winner - Rating data for the winning item
 * @param loser - Rating data for the losing item
 * @returns New rating data for both items
 */
export function processComparison(
  winner: RatingData,
  loser: RatingData,
): { winner: RatingData; loser: RatingData } {
  const winnerMatch: MatchResult = {
    opponentRating: loser.rating,
    opponentRd: loser.rd,
    score: 1, // Win
  };

  const loserMatch: MatchResult = {
    opponentRating: winner.rating,
    opponentRd: winner.rd,
    score: 0, // Loss
  };

  return {
    winner: updateRating(winner, [winnerMatch]),
    loser: updateRating(loser, [loserMatch]),
  };
}

/**
 * Process a tie (draw) between two items
 *
 * @param item1 - Rating data for first item
 * @param item2 - Rating data for second item
 * @returns New rating data for both items
 */
export function processTie(
  item1: RatingData,
  item2: RatingData,
): { item1: RatingData; item2: RatingData } {
  const item1Match: MatchResult = {
    opponentRating: item2.rating,
    opponentRd: item2.rd,
    score: 0.5, // Tie
  };

  const item2Match: MatchResult = {
    opponentRating: item1.rating,
    opponentRd: item1.rd,
    score: 0.5, // Tie
  };

  return {
    item1: updateRating(item1, [item1Match]),
    item2: updateRating(item2, [item2Match]),
  };
}

/**
 * Predict the expected outcome of a match between two items
 *
 * @param item1 - Rating data for first item
 * @param item2 - Rating data for second item
 * @returns Probability that item1 wins (0 to 1)
 */
export function predictOutcome(item1: RatingData, item2: RatingData): number {
  const internal1 = toInternalRating(item1.rating);
  const internal2 = toInternalRating(item2.rating);
  const rd1 = toInternalRd(item1.rd);
  const rd2 = toInternalRd(item2.rd);

  // Combined RD for prediction
  const combinedRd = Math.sqrt(rd1 * rd1 + rd2 * rd2);

  return 1 / (1 + Math.exp(-g(combinedRd) * (internal1 - internal2)));
}

/**
 * Apply RD decay for an item that hasn't been compared recently
 * RD increases over time to reflect growing uncertainty
 *
 * @param current - Current rating data
 * @param periods - Number of rating periods since last comparison
 * @returns Updated rating data with increased RD
 */
export function applyRdDecay(current: RatingData, periods: number = 1): RatingData {
  let rd = toInternalRd(current.rd);

  for (let i = 0; i < periods; i++) {
    rd = preRatingPeriodRd(rd, current.volatility);
  }

  return {
    rating: current.rating,
    rd: Math.min(Math.round(toPublicRd(rd)), GLICKO_DEFAULT_RD),
    volatility: current.volatility,
  };
}

/**
 * Create initial rating data for a new item
 */
export function createInitialRating(): RatingData {
  return {
    rating: GLICKO_DEFAULT_RATING,
    rd: GLICKO_DEFAULT_RD,
    volatility: GLICKO_DEFAULT_VOLATILITY,
  };
}

/**
 * Check if an item is considered "ranked" (has sufficient confidence)
 *
 * @param rd - Rating deviation
 * @param threshold - RD threshold for confidence (default from constants)
 * @returns true if the item is ranked (RD below threshold)
 */
export function isRanked(rd: number, threshold?: number): boolean {
  const rdThreshold = threshold ?? RD_CONFIDENCE_THRESHOLD;
  return rd <= rdThreshold;
}
