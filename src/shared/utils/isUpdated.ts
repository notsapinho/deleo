import { Result } from "@sapphire/result";
import axios from "axios";
import chalk from "chalk";

import { Logger } from "../logger";

export const isUpdated = async (
    currentVersion: string
): Promise<Result<void, any>> => {
    return Result.fromAsync(async () => {
        const { data } = await axios.get("https://registry.npmjs.com/deleo");

        if (currentVersion === data["dist-tags"].latest) return;

        // update message
        console.log(
            Logger.centerText(
                chalk`{rgb(255,42,88).bold Update available!} {grey ${currentVersion} → ${data["dist-tags"].latest}}`
            )
        );

        console.log(
            Logger.centerText(
                chalk`{white Run {yellow.bold npm i -g deleo} to update!}`
            )
        );

        console.log();
    });
};
