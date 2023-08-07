import chalk from "chalk";
import { removeColors } from "./utils";
import { Logger } from "./logger";

export const DEFAULT_SEARCH_LIMIT = 100;

export const PROGRESS_BAR_FORMAT = `${" ".repeat(removeColors(Logger.tag).length - 1)}${chalk.rgb(
    237,
    112,
    20
)("╚═")} ${chalk.rgb(237, 112, 20)("{bar}")} ${chalk.rgb(237, 112, 20)("|")} {percentage}% ${chalk.rgb(
    237,
    112,
    20
)("|")} {value}/{total} ${chalk.rgb(237, 112, 20)("|")} Elapsed: {duration_formatted} ${chalk.rgb(
    237,
    112,
    20
)("|")} ETA: {eta_formatted}`;
