#! /usr/bin/env node
import type {
    Collection,
    DMChannel,
    NonThreadGuildBasedChannel,
    TextBasedChannel
} from "discord.js-selfbot-v13";

import { Result } from "@sapphire/result";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";

import {
    AuthManager,
    DeleoClient,
    MessageDeleterEvents,
    PackageOpenerEvents
} from "@/core";
import { Logger } from "@/shared";
import { checkbox } from "@/shared/prompts";
import { getChannelName, isUpdated, pluralize, truncate } from "@/shared/utils";
import { description, version } from "../package.json";

export type ProgramOptions = {
    token: string;
    deleteDelay: number;
    openDelay: number;
    closeDms: boolean;
    verbose: boolean;
    checkUpdates: boolean;
};

const program = new Command();

program
    .name("deleo")
    .description(description)
    .version(version, "-v, --version", "Output the current version")
    .option("-t, --token <token>", "Your discord token")
    .option("--verbose", "Enable verbose logging (disables progress bar)")
    .option("--check-updates", "Check for updates", true)
    .helpCommand("help [command]", "Display help for command")
    .helpOption("-h, --help", "Display help for command");

program
    .command("delete")
    .description("Delete messages from open DMs or a specified channel.")
    .option(
        "-d, --delete-delay <delay>",
        "Delay between each message deletion in ms",
        "300"
    )
    .option("--close-dms", "Close DMs after deleting messages")
    .action(async (options: ProgramOptions) => {
        Logger.banner();

        const opts = { ...program.opts<ProgramOptions>(), ...options };
        if (opts.checkUpdates) await isUpdated(version);

        const client = new DeleoClient(opts);

        const token = await client.getToken();

        if (token.isErr()) {
            Logger.error(token.unwrapErr());
            process.exit();
        }

        client.on("ready", async () => {
            Logger.success(`Logged in as ${client.user?.tag}!`);

            const { option } = await inquirer.prompt({
                name: "option",
                type: "list",
                message: chalk`{white Select an option {rgb(237,112,20).bold >>}}`,
                prefix: Logger.tag,
                choices: [
                    {
                        name: "Delete messages from open DMs",
                        value: "deleteMessagesFromOpenedDMs"
                    },
                    {
                        name: "Delete all messages from a guild",
                        value: "deleteMessagesFromGuild"
                    },
                    {
                        name: "Delete all messages from a specified channel",
                        value: "deleteMessagesFromChannel"
                    }
                ]
            });

            switch (option) {
                case "deleteMessagesFromOpenedDMs":
                    {
                        const channels = client.channels.cache.filter(
                            (channel) =>
                                ["DM", "GROUP_DM"].includes(channel.type)
                        ) as Collection<string, DMChannel | TextBasedChannel>;

                        console.log(channels);

                        const channelsToDelete = await checkbox({
                            message: chalk`{white Select the channels you want to delete messages from {rgb(237,112,20).bold >>}}`,
                            prefix: Logger.tag,
                            default: channels.map((channel) => channel.id),
                            choices: channels.map((channel) => ({
                                name: getChannelName(channel),
                                value: channel.id
                            })),
                            transformer: (choices) =>
                                chalk`{cyan Selected {bold ${
                                    choices.length
                                }} ${pluralize("channel", choices.length)}}`
                        });

                        if (channelsToDelete.length === 0) {
                            Logger.error(
                                "You must select at least one channel."
                            );
                            process.exit();
                        }

                        console.log();

                        const deleteMessagesFromChannelsResult =
                            await client.deleteMessagesFromChannels(
                                channelsToDelete
                            );

                        if (deleteMessagesFromChannelsResult.isErr()) {
                            Logger.error(
                                "Something went wrong while deleting messages."
                            );
                            console.log(
                                deleteMessagesFromChannelsResult.unwrapErr()
                            );
                            process.exit();
                        }
                    }
                    break;
                case "deleteMessagesFromChannel":
                    {
                        const { channelId } = await inquirer.prompt({
                            name: "channelId",
                            type: "input",
                            message: chalk`{white Enter the channel id {rgb(237,112,20).bold >>}}`,
                            prefix: Logger.tag,
                            transformer: (input) => input
                        });

                        console.log();

                        const deleteMessagesFromChannelResult =
                            await client.deleteMessagesFromChannel(channelId);

                        if (deleteMessagesFromChannelResult.isErr()) {
                            Logger.error(
                                "Something went wrong while deleting messages."
                            );
                            console.log(
                                deleteMessagesFromChannelResult.unwrapErr()
                            );
                            process.exit();
                        }
                    }
                    break;
                case "deleteMessagesFromGuild":
                    {
                        const { guildId } = await inquirer.prompt({
                            name: "guildId",
                            type: "input",
                            message: chalk`{white Enter the guild id {rgb(237,112,20).bold >>}}`,
                            prefix: Logger.tag,
                            transformer: (input) => input
                        });

                        console.log();

                        const guildResult = await Result.fromAsync(() =>
                            client.guilds.fetch(guildId)
                        );

                        if (guildResult.isErr()) {
                            Logger.error("Invalid guild ID provided.");
                            process.exit();
                        }

                        const guild = guildResult.unwrap();

                        const channelsResult = await Result.fromAsync(() =>
                            guild.channels.fetch()
                        );

                        if (channelsResult.isErr()) {
                            Logger.error(
                                "Something went wrong while fetching guild channels."
                            );
                            process.exit();
                        }

                        const channels = channelsResult.unwrap();

                        const visibleChannels = channels.filter(
                            (channel) => channel?.viewable && channel?.isText()
                        ) as Collection<string, NonThreadGuildBasedChannel>;

                        const channelsToDeleteFrom = await checkbox({
                            message: chalk`{white Select the channels you want to delete messages from {rgb(237,112,20).bold >>}}`,
                            prefix: Logger.tag,
                            default: visibleChannels.map(
                                (channel) => channel.id
                            ),
                            choices: visibleChannels.map((channel) => ({
                                name: channel.name,
                                value: channel.id
                            })),
                            transformer: (choices) =>
                                chalk`{cyan Selected {bold ${
                                    choices.length
                                }} ${pluralize("channel", choices.length)}}`
                        });

                        if (channelsToDeleteFrom.length === 0) {
                            Logger.error(
                                "You must select at least one channel."
                            );
                            process.exit();
                        }

                        console.log();

                        const deleteMessagesFromChannelsResult =
                            await client.deleteMessagesFromChannels(
                                channelsToDeleteFrom
                            );

                        if (deleteMessagesFromChannelsResult.isErr()) {
                            Logger.error(
                                "Something went wrong while deleting messages."
                            );
                            process.exit();
                        }
                    }
                    break;
            }

            Logger.success("Done!");

            client.destroy();
            process.exit();
        });

        client.deleter.on(MessageDeleterEvents.Ready, (channel) => {
            Logger.log(
                chalk`{white Deleting an approximate total of {yellow.bold ${
                    client.deleter.approximateTotal
                }} ${pluralize(
                    "message",
                    client.deleter.approximateTotal
                )} from {yellow.bold ${getChannelName(channel)}}}`
            );

            if (!opts.verbose)
                client.progress.start(client.deleter.approximateTotal, 0);
        });

        client.deleter.on(MessageDeleterEvents.Delete, (message) => {
            if (opts.verbose)
                Logger.log(
                    chalk`{white Deleted {yellow.bold ${message.id}} - ${
                        message.author.tag
                    }: ${truncate(message.content, 20)}}`
                );
            else client.progress.increment();
        });

        client.deleter.on(MessageDeleterEvents.FailedDelete, (message) => {
            if (opts.verbose)
                Logger.error(`Failed to delete message ${message.id}.`);
            else client.progress.increment();
        });

        client.deleter.on(
            MessageDeleterEvents.Done,
            async (channel: TextBasedChannel) => {
                if (!opts.verbose) {
                    client.progress.update(client.deleter.approximateTotal);
                    client.progress.stop();
                }

                if (opts.closeDms && channel.type === "DM") {
                    if (opts.verbose)
                        Logger.log(
                            chalk`{white Closing DM with {yellow.bold ${channel.recipient.tag}}}`
                        );

                    if (opts.closeDms)
                        await client.users
                            .deleteDM(channel.recipient.id)
                            .catch(() => null);
                }

                console.log();
            }
        );

        try {
            Logger.warn("Logging in...");

            await client.login(token.unwrap());
        } catch (error) {
            Logger.error("Invalid token.");
            process.exit();
        }
    });

program
    .command("open")
    .description("Opens all DMs provided by the Discord Data Package.")
    .option("--open-delay <delay>", "Delay between each DM open in ms", "300")
    .action(async (options: ProgramOptions) => {
        Logger.banner();

        const opts = { ...program.opts<ProgramOptions>(), ...options };
        if (opts.checkUpdates) await isUpdated(version);

        const client = new DeleoClient(opts);

        const token = await client.getToken();

        if (token.isErr()) {
            Logger.error(token.unwrapErr());
            process.exit();
        }

        client.on("ready", async () => {
            Logger.success(`Logged in as ${client.user?.tag}!`);

            const { packageDataFolder } = await inquirer.prompt({
                name: "packageDataFolder",
                type: "input",
                message: chalk`{white Enter the path to the Discord Data Package {rgb(237,112,20).bold messages} folder {rgb(237,112,20).bold >>}}`,
                prefix: Logger.tag,
                transformer: (input) => input
            });

            console.log();

            const readResult =
                await client.packageOpener.readPackage(packageDataFolder);

            if (readResult.isErr()) {
                Logger.error("Failed to read the Discord Data Package.");
                process.exit();
            }

            const openResult = await client.packageOpener.openChannels(
                readResult.unwrap()
            );

            if (openResult.isErr()) {
                Logger.error(
                    "Something went wrong while opening the channels."
                );
                console.log(openResult.unwrapErr());
                process.exit();
            }

            Logger.success("Done!");

            client.destroy();
            process.exit();
        });

        client.packageOpener.on(PackageOpenerEvents.Ready, (channels) => {
            Logger.log(
                chalk`{white Opening a total of {yellow.bold ${
                    channels.length
                }} ${pluralize("channel", channels.length)}}`
            );

            if (!opts.verbose) client.progress.start(channels.length, 0);
        });

        client.packageOpener.on(PackageOpenerEvents.Load, (channel) => {
            if (opts.verbose)
                Logger.log(chalk`{white Loaded {yellow.bold ${channel.id}}}`);
        });

        client.packageOpener.on(PackageOpenerEvents.FailedToLoad, (dir) => {
            if (opts.verbose)
                Logger.error(
                    chalk`{white Failed to load {yellow.bold ${dir}}}`
                );
        });

        client.packageOpener.on(PackageOpenerEvents.Open, (channel) => {
            if (opts.verbose)
                Logger.log(
                    chalk`{white Opened {yellow.bold ${
                        channel.id
                    }} - ${getChannelName(channel)}}`
                );
            else client.progress.increment();
        });

        client.packageOpener.on(PackageOpenerEvents.FailedToOpen, (channel) => {
            if (opts.verbose)
                Logger.error(
                    chalk`{white Failed to open {yellow.bold ${channel.id}}}`
                );
            else client.progress.increment();
        });

        client.packageOpener.on(PackageOpenerEvents.Done, (openedChannels) => {
            if (!opts.verbose) {
                client.progress.update(openedChannels.length);
                client.progress.stop();
            }

            console.log();
        });

        try {
            Logger.warn("Logging in...");

            await client.login(token.unwrap());
        } catch (error) {
            Logger.error("Invalid token.");
            process.exit();
        }
    });

program
    .command("auth")
    .description("Save your discord token.")
    .argument("<token>", "Your discord token")
    .action(async (token: string) => {
        Logger.banner();

        const opts = program.opts<ProgramOptions>();

        if (opts.checkUpdates) await isUpdated(version);

        const cachedToken = await AuthManager.getToken();

        if (cachedToken.isOk()) {
            const { confirm } = await inquirer.prompt({
                name: "confirm",
                type: "confirm",
                message: chalk`{white Are you sure you want to overwrite your saved token?}`,
                prefix: Logger.tag
            });

            if (!confirm) return;

            const tokenSet = await AuthManager.setToken(token);

            if (tokenSet.isErr()) {
                Logger.error(tokenSet.unwrapErr());
                process.exit();
            }

            Logger.success("Successfully saved the new token!");
        } else {
            const tokenSet = await AuthManager.setToken(token);

            if (tokenSet.isErr()) {
                Logger.error(tokenSet.unwrapErr());
                process.exit();
            }

            Logger.success("Successfully saved the token!");
        }
    });

program.parse(process.argv);
