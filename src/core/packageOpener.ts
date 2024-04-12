import EventEmitter from "events";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type {
    BaseFetchOptions,
    Collection,
    DMChannel,
    Snowflake,
    TextBasedChannel
} from "discord.js-selfbot-v13";

import { Result } from "@sapphire/result";
import TypedEmitter from "typed-emitter";

import { sleep } from "@/shared/utils";
import { DeleoClient } from "./client";

export interface PackageOpenerOptions {
    openDelay: number;
}

export enum PackageOpenerEvents {
    Ready = "ready",
    Load = "load",
    FailedToLoad = "failedToLoad",
    Open = "open",
    FailedToOpen = "failedToOpen",
    Done = "done"
}

export type PackageOpenerEventMappings = {
    [PackageOpenerEvents.Ready]: (loadedChannels: PackageChannel[]) => void;
    [PackageOpenerEvents.Load]: (packageChannel: PackageChannel) => void;
    [PackageOpenerEvents.FailedToLoad]: (folder: string) => void;
    [PackageOpenerEvents.Open]: (channel: DMChannel) => void;
    [PackageOpenerEvents.FailedToOpen]: (channel: PackageChannel) => void;
    [PackageOpenerEvents.Done]: (openedChannels: DMChannel[]) => void;
};

export interface PackageChannel {
    id: string;
    type: number;
    recipients?: string[];
}

export class PackageOpener extends (EventEmitter as new () => TypedEmitter<PackageOpenerEventMappings>) {
    public loadedChannels: PackageChannel[] = [];

    public constructor(
        private readonly client: DeleoClient,
        public options: PackageOpenerOptions
    ) {
        super();
    }

    public async readPackage(
        baseDir: string
    ): Promise<Result<PackageChannel[], any>> {
        return Result.fromAsync(async () => {
            const channelFolders = await readdir(baseDir);

            for (const folder of channelFolders) {
                if (folder === "index.json") continue;

                const parsedResult = await Result.fromAsync<PackageChannel>(
                    async () => {
                        const channel = await readFile(
                            join(baseDir, folder, "channel.json"),
                            "utf-8"
                        );

                        return Result.ok(JSON.parse(channel));
                    }
                );

                if (parsedResult.isErr()) {
                    this.emit(PackageOpenerEvents.FailedToLoad, folder);

                    continue;
                }

                const parsed = parsedResult.unwrap();

                parsed.recipients =
                    parsed.recipients?.filter(
                        (r) => r !== this.client.user.id
                    ) || [];

                if (!parsed.recipients.length) continue;

                this.loadedChannels.push(parsed);

                this.emit(PackageOpenerEvents.Load, parsed);
            }

            this.emit(PackageOpenerEvents.Ready, this.loadedChannels);

            return Result.ok(this.loadedChannels);
        });
    }

    public async openChannels(
        channels: PackageChannel[]
    ): Promise<Result<DMChannel[], any>> {
        return Result.fromAsync(async () => {
            const openedChannels: DMChannel[] = [];

            const currentChannels = this.client.channels.cache.filter(
                (channel) => ["DM", "GROUP_DM"].includes(channel.type)
            ) as Collection<string, DMChannel | TextBasedChannel>;

            const channelsToOpen = channels.filter(
                (channel) => !currentChannels.some((c) => c.id === channel.id)
            );

            for (const channel of channelsToOpen) {
                const opened = await Result.fromAsync(async () => {
                    if (!channel.recipients) return Result.err();

                    const openedChannel = await this.openRecipient(
                        channel.recipients
                    );

                    return Result.ok(openedChannel as DMChannel);
                });

                if (opened.isErr()) {
                    this.emit(PackageOpenerEvents.FailedToOpen, channel);
                    continue;
                }

                openedChannels.push(opened.unwrap());

                this.emit(PackageOpenerEvents.Open, opened.unwrap());

                await sleep(this.options.openDelay);
            }

            this.emit(PackageOpenerEvents.Done, openedChannels);

            return Result.ok(openedChannels);
        });
    }

    private async openRecipient(
        recipients: Snowflake[],
        { cache = true }: BaseFetchOptions = {}
    ) {
        // @ts-ignore
        const data = await this.client.api.users("@me").channels.post({
            data: {
                recipients,
            },
            DiscordContext: {}
        });

        // @ts-ignore
        const dmChannel = this.client.channels._add(data, null, { cache });
        // @ts-ignore
        await dmChannel.sync();
        return dmChannel;
    }
}
