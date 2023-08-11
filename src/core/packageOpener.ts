import { readFile, readdir } from "fs/promises";
import { join } from "path";
import EventEmitter from "events";

import { DMChannel } from "discord.js-selfbot-v13";
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
    FailedToLoad = "failed_to_load",
    Open = "open",
    FailedToOpen = "failed_to_open",
    Done = "done"
}

export type PackageOpenerEventMappings = {
    [PackageOpenerEvents.Ready]: (loaded_channels: PackageChannel[]) => void;
    [PackageOpenerEvents.Load]: (package_channel: PackageChannel) => void;
    [PackageOpenerEvents.FailedToLoad]: (folder: string) => void;
    [PackageOpenerEvents.Open]: (channel: DMChannel) => void;
    [PackageOpenerEvents.FailedToOpen]: (channel: PackageChannel) => void;
    [PackageOpenerEvents.Done]: (opened_channels: DMChannel[]) => void;
};

export interface PackageChannel {
    id: string;
    type: number;
    recipients?: string[];
}

export class PackageOpener extends (EventEmitter as new () => TypedEmitter<PackageOpenerEventMappings>) {
    public loaded_channels: PackageChannel[] = [];

    public constructor(private readonly client: DeleoClient, public options: PackageOpenerOptions) {
        super();
    }

    public async readPackage(base_dir: string): Promise<Result<PackageChannel[], any>> {
        return Result.fromAsync(async () => {
            const channel_folders = await readdir(base_dir);

            for (const folder of channel_folders) {
                if (folder === "index.json") continue;

                const parsedResult = await Result.fromAsync<PackageChannel>(async () => {
                    const channel = await readFile(join(base_dir, folder, "channel.json"), "utf-8");

                    return Result.ok(JSON.parse(channel));
                });

                if (parsedResult.isErr()) {
                    this.emit(PackageOpenerEvents.FailedToLoad, folder);

                    continue;
                }

                const parsed = parsedResult.unwrap();

                parsed.recipients = parsed.recipients?.filter((r) => r !== this.client.user.id) || [];

                if (!parsed.recipients.length) continue;

                this.loaded_channels.push(parsed);

                this.emit(PackageOpenerEvents.Load, parsed);
            }

            this.emit(PackageOpenerEvents.Ready, this.loaded_channels);

            return Result.ok(this.loaded_channels);
        });
    }

    public async openChannels(channels: PackageChannel[]): Promise<Result<DMChannel[], any>> {
        return Result.fromAsync(async () => {
            const opened_channels: DMChannel[] = [];

            for (const channel of channels) {
                const opened = await Result.fromAsync(async () => {
                    if (!channel.recipients) return Result.err();

                    const opened_channel = await this.client.users.openRecipient(channel.recipients);

                    return Result.ok(opened_channel as DMChannel);
                });

                if (opened.isErr()) {
                    this.emit(PackageOpenerEvents.FailedToOpen, channel);
                    continue;
                }

                opened_channels.push(opened.unwrap());

                this.emit(PackageOpenerEvents.Open, opened.unwrap());

                await sleep(this.options.openDelay);
            }

            this.emit(PackageOpenerEvents.Done, opened_channels);

            return Result.ok(opened_channels);
        });
    }
}
