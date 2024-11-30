import path from "path";

/**
 * Alpha numeric with dashes and underscores.
 */
export const REGEX_ALPHA_NUMERIC_DASHES = /^[a-zA-Z0-9-_]+$/;

export const PATH_CONFIG_JOBS = path.join(process.cwd(), "./config/jobs");

export const DURATION_SECOND = 1;
export const DURATION_MINUTE = 60;
export const DURATION_HOUR = DURATION_MINUTE * 60;
export const DURATION_DAY = DURATION_HOUR * 24;
export const DURATION_WEEK = DURATION_DAY * 7;
