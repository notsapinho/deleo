import { Presets, SingleBar } from "cli-progress";
import { Client, TextBasedChannel } from "discord.js-selfbot-v13";
import { Result } from "@sapphire/result";
import chalk from "chalk";
import inquirer from "inquirer";

import { Logger, PROGRESS_BAR_FORMAT, truncate } from "@/shared";
import { MessageDeleter, AuthManager } from "./";
import { ProgramOptions } from "..";

export class DeleoClient extends Client {
    public readonly progress = new SingleBar(
        {
            format: PROGRESS_BAR_FORMAT,
            stopOnComplete: false
        },
        Presets.shades_classic
    );

    public readonly deleter: MessageDeleter;

    public constructor(public readonly opts: ProgramOptions) {
        super({
            checkUpdate: false
        });

        this.deleter = new MessageDeleter({
            deleteDelay: opts.deleteDelay
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
                    transformer: (input, _, flags) => (flags.isFinal ? truncate(input, 10) : input)
                });

                return Result.ok(token);
            }
        });
    }

    public async deleteMessagesFromChannels(channels_to_delete: string[]): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            for (const channel_id of channels_to_delete) {
                const result = await this.deleteMessagesFromChannel(channel_id);

                if (result.isErr()) return Result.err(result.unwrapErr());
            }
        });
    }

    public async deleteMessagesFromChannel(channel_id: string): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            const channel = (await this.channels.fetch(channel_id).catch(() => null)) as TextBasedChannel;

            if (!channel) return Result.err("Invalid channel ID provided.");

            const result = await this.deleter.deleteChannelMessages(channel);

            if (result.isErr()) return Result.err(result.unwrapErr());
        });
    }
}
