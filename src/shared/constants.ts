import chalk from "chalk";

export const DEFAULT_SEARCH_LIMIT = 100;

// 5 spaces stands for the logger tag
export const PROGRESS_BAR_FORMAT = `${" ".repeat(5)}${chalk.rgb(237, 112, 20)("╚═")} ${chalk.rgb(
    237,
    112,
    20
)("{bar}")} ${chalk.rgb(237, 112, 20)("|")} {percentage}% ${chalk.rgb(237, 112, 20)("|")} {value}/{total} ${chalk.rgb(
    237,
    112,
    20
)("|")} Elapsed: {duration_formatted} ${chalk.rgb(237, 112, 20)("|")} ETA: {eta_formatted}`;
