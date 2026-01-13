/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as comparisons from "../comparisons.js";
import type * as crons from "../crons.js";
import type * as export_ from "../export.js";
import type * as import_ from "../import.js";
import type * as importJob from "../importJob.js";
import type * as importJobMutations from "../importJobMutations.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_glicko2 from "../lib/glicko2.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_malUtils from "../lib/malUtils.js";
import type * as library from "../library.js";
import type * as maintenance from "../maintenance.js";
import type * as media from "../media.js";
import type * as ranking from "../ranking.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  comparisons: typeof comparisons;
  crons: typeof crons;
  export: typeof export_;
  import: typeof import_;
  importJob: typeof importJob;
  importJobMutations: typeof importJobMutations;
  "lib/constants": typeof lib_constants;
  "lib/glicko2": typeof lib_glicko2;
  "lib/logger": typeof lib_logger;
  "lib/malUtils": typeof lib_malUtils;
  library: typeof library;
  maintenance: typeof maintenance;
  media: typeof media;
  ranking: typeof ranking;
  stats: typeof stats;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
