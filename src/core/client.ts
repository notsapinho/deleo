import type { Message, TextBasedChannel } from "discord.js-selfbot-v13";
import type { ProgramOptions } from "../";

import { Result } from "@sapphire/result";
import chalk from "chalk";
import { Presets, SingleBar } from "cli-progress";
import { Client } from "discord.js-selfbot-v13";
import inquirer from "inquirer";

import { Logger, PROGRESS_BAR_FORMAT } from "@/shared";
import { truncate } from "@/shared/utils";
import { AuthManager, MessageDeleter, PackageOpener } from "./";

export class DeleoClient extends Client {
    public readonly progress = new SingleBar(
        {
            format: PROGRESS_BAR_FORMAT,
            stopOnComplete: false,
            hideCursor: true
        },
        Presets.shades_classic
    );

    public readonly deleter: MessageDeleter;

    public readonly packageOpener: PackageOpener;

    public constructor(public readonly opts: ProgramOptions) {
        super();

        this.deleter = new MessageDeleter({
            deleteDelay: Number(opts.deleteDelay)
        });

        this.packageOpener = new PackageOpener(this, {
            openDelay: Number(opts.openDelay)
        });
    }

    public async getToken(): Promise<Result<string, any>> {
        return Result.fromAsync(async () => {
            const cachedToken = await AuthManager.getToken();

            if (cachedToken.isOk()) {
                return Result.ok(cachedToken.unwrap());
            } else if (this.opts.token) {
                return Result.ok(this.opts.token);
            } else {
                const { token } = await inquirer.prompt({
                    name: "token",
                    type: "input",
                    message: chalk`{white Enter your token {rgb(237,112,20).bold >>}}`,
                    prefix: Logger.tag,
                    transformer: (input, _, flags) =>
                        flags.isFinal ? truncate(input, 10) : input
                });

                return Result.ok(token);
            }
        });
    }

    public async deleteMessagesFromChannels(
        channelsToDelete: string[]
    ): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            for (const channelId of channelsToDelete) {
                const result = await this.deleteMessagesFromChannel(channelId);

                if (result.isErr()) continue;
            }
        });
    }

    public async deleteMessagesFromChannel(
        channelId: string
    ): Promise<Result<Message[], any>> {
        return Result.fromAsync(async () => {
            const channelResult = await Result.fromAsync(
                async () => await this.channels.fetch(channelId)
            );

            if (channelResult.isErr())
                return Result.err("Invalid channel ID provided.");

            const channel = channelResult.unwrap() as TextBasedChannel;

            return await this.deleter.deleteChannelMessages(channel);
        });
    }
}
