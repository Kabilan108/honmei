type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEventData {
  event: string;
  [key: string]: unknown;
}

interface FormattedLogEvent extends LogEventData {
  timestamp: string;
  level: LogLevel;
}

function formatLog(event: FormattedLogEvent): string {
  return JSON.stringify(event);
}

function log(level: LogLevel, data: LogEventData): FormattedLogEvent {
  const fullEvent: FormattedLogEvent = {
    ...data,
    timestamp: new Date().toISOString(),
    level,
  };

  const formatted = formatLog(fullEvent);

  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }

  return fullEvent;
}

export const logger = {
  debug: (data: LogEventData) => log("debug", data),
  info: (data: LogEventData) => log("info", data),
  warn: (data: LogEventData) => log("warn", data),
  error: (data: LogEventData) => log("error", data),
};

export const importLogger = {
  started: (jobId: string, itemCount: number) =>
    logger.info({
      event: "import_started",
      jobId,
      itemCount,
    }),

  batchStarted: (
    jobId: string,
    batchIndex: number,
    totalBatches: number,
    itemCount: number,
  ) =>
    logger.info({
      event: "import_batch_started",
      jobId,
      batchIndex,
      totalBatches,
      itemCount,
    }),

  batchCompleted: (
    jobId: string,
    batchIndex: number,
    successCount: number,
    failCount: number,
    durationMs: number,
  ) =>
    logger.info({
      event: "import_batch_completed",
      jobId,
      batchIndex,
      successCount,
      failCount,
      durationMs,
    }),

  completed: (jobId: string, successCount: number, failCount: number) =>
    logger.info({
      event: "import_completed",
      jobId,
      successCount,
      failCount,
    }),

  failed: (jobId: string, error: string) =>
    logger.error({
      event: "import_failed",
      jobId,
      error,
    }),
};

export const anilistLogger = {
  fetchStarted: (malId: number, mediaType: "ANIME" | "MANGA", title: string) =>
    logger.debug({
      event: "anilist_fetch_started",
      malId,
      mediaType,
      title,
    }),

  fetchSuccess: (
    malId: number,
    mediaType: "ANIME" | "MANGA",
    anilistId: number,
    responseTimeMs: number,
    fallbackUsed: boolean,
  ) =>
    logger.info({
      event: "anilist_fetch_success",
      malId,
      mediaType,
      anilistId,
      responseTimeMs,
      fallbackUsed,
    }),

  fetchFailed: (
    malId: number,
    mediaType: "ANIME" | "MANGA",
    title: string,
    error: string,
    retryCount: number,
  ) =>
    logger.warn({
      event: "anilist_fetch_failed",
      malId,
      mediaType,
      title,
      error,
      retryCount,
    }),

  rateLimited: (retryAfterMs?: number) =>
    logger.warn({
      event: "anilist_rate_limited",
      error: `Rate limited${retryAfterMs ? `, retry after ${retryAfterMs}ms` : ""}`,
    }),
};
