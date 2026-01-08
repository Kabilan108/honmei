/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as anilist from "../anilist.js";
import type * as comparisons from "../comparisons.js";
import type * as export_ from "../export.js";
import type * as import_ from "../import.js";
import type * as library from "../library.js";
import type * as media from "../media.js";
import type * as ranking from "../ranking.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  anilist: typeof anilist;
  comparisons: typeof comparisons;
  export: typeof export_;
  import: typeof import_;
  library: typeof library;
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
