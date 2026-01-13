import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3:00 AM UTC
crons.daily(
  "archive old comparisons",
  { hourUTC: 3, minuteUTC: 0 },
  internal.maintenance.archiveOldComparisons,
);

crons.daily(
  "decay rating deviations",
  { hourUTC: 3, minuteUTC: 30 },
  internal.maintenance.decayRatings,
);

export default crons;
