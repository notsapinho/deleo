import chalk from "chalk";
import { version, author } from "../../package.json";
import figlet from "figlet";

import { removeColors } from "./utils";

export class Logger {
    public static tag = chalk`{rgb(237,112,20).bold [Deleo]}`;

    public static log = (text: string): void => console.log(chalk`${Logger.tag} ${text}`);

    public static error = (text: string): void => console.log(chalk`${Logger.tag} {red ${text}}`);

    public static success = (text: string): void => console.log(chalk`${Logger.tag} {green ${text}}`);

    public static warn = (text: string): void => console.log(chalk`${Logger.tag} {yellow ${text}}`);

    public static banner = (): void => {
        console.clear();

        Logger.setTerminalTitle();

        console.log(
            //
            Logger.centerText(
                //
                Logger.fadeText(
                    //
                    figlet.textSync("deleo", "Slant"),
                    { r: 237, g: 112, b: 20 },
                    17
                )
            )
        );

        console.log(
            //
            Logger.centerText(
                //
                chalk`{rgb(237,112,20).bold ⚡{white v${version}} {rgb(237,112,20).bold @${author}}}`
            )
        );

        console.log();
    };

    public static setTerminalTitle = (text: string = ""): void => {
        process.stdout.write(`\x1b]0;Deleo v${version} ${text}\x07`);
    };

    public static centerText = (text: string, space?: number): string =>
        text
            .split(/\r?\n/)
            .map(
                (line, _, lines) =>
                    " ".repeat(
                        space ?? (process.stdout.columns - removeColors(lines[Math.floor(lines.length / 2)]).length) / 2
                    ) + line
            )
            .join("\n");

    public static fadeText = (
        text: string,
        startColor: { r: number; g: number; b: number },
        increment: number
    ): string =>
        text
            .split(/\r?\n/)
            .map(
                (line, i) =>
                    `\x1b[38;2;${Math.min(startColor.r + increment * i, 255)};${Math.min(
                        startColor.g + increment * i,
                        255
                    )};${Math.min(startColor.b + increment * i, 255)}m${line}\x1b[0m`
            )
            .join("\n");
}
