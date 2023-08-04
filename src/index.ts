#! /usr/bin/env node

import { version, description } from "../package.json";

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { Collection, DMChannel, TextBasedChannel } from "discord.js-selfbot-v13";

import { MessageDeleterEvents, AuthManager, DeleoClient } from "@/core";
import { Logger, pluralize, truncate } from "@/shared";

export type ProgramOptions = {
    token: string;
    deleteDelay: number;
    verbose: boolean;
};

const program = new Command();

program
    .name("deleo")
    .description(description)
    .version(version, "-v, --version", "Output the current version")
    .option("-t, --token <token>", "Your discord token")
    .option("-d, --delete-delay <delay>", "Delay between each message deletion in ms", "300")
    .option("--verbose", "Enable verbose logging (disables progress bar)")
    .addHelpCommand("help [command]", "Display help for command")
    .helpOption("-h, --help", "Display help for command");

program
    .command("delete")
    .description("Delete messages from open DMs or a specified channel.")
    .action(async () => {
        Logger.banner();

        const opts = program.opts<ProgramOptions>();
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
                        name: "Delete all messages from a specified channel",
                        value: "deleteMessagesFromChannel"
                    }
                ]
            });

            switch (option) {
                case "deleteMessagesFromOpenedDMs":
                    const channels = client.channels.cache.filter((channel) =>
                        ["DM", "GROUP_DM"].includes(channel.type)
                    ) as Collection<string, DMChannel | TextBasedChannel>;

                    const { channels_to_delete } = await inquirer.prompt({
                        name: "channels_to_delete",
                        type: "checkbox",
                        message: chalk`{white Select the channels you want to delete messages from {rgb(237,112,20).bold >>}}`,
                        prefix: Logger.tag,
                        default: channels.map((channel) => channel.id),
                        choices: channels.map((channel) => ({
                            name: channel.type === "DM" ? channel.recipient.username : channel.name,
                            value: channel.id
                        }))
                    });

                    console.log();

                    await client.deleteMessagesFromChannels(channels_to_delete);

                    break;
                case "deleteMessagesFromChannel":
                    const { channel_id } = await inquirer.prompt({
                        name: "channel_id",
                        type: "input",
                        message: chalk`{white Enter the channel id {rgb(237,112,20).bold >>}}`,
                        prefix: Logger.tag,
                        transformer: (input) => input
                    });

                    await client.deleteMessagesFromChannel(channel_id);

                    break;
            }

            Logger.success("Done!");

            client.destroy();
            process.exit();
        });

        client.deleter.on(MessageDeleterEvents.Ready, (channel) => {
            Logger.log(
                chalk`{white Deleting an approximate total of {yellow.bold ${
                    client.deleter.approximate_total
                }} ${pluralize("message", client.deleter.approximate_total)} from {yellow.bold ${
                    channel.type === "DM" ? channel.recipient.tag : channel.name
                }}}`
            );

            if (!opts.verbose) client.progress.start(client.deleter.approximate_total, 0);
        });

        client.deleter.on(MessageDeleterEvents.Delete, (message) => {
            if (opts.verbose)
                Logger.log(
                    chalk`{white Deleted {yellow.bold ${message.id}} - ${message.author.tag}: ${truncate(
                        message.content,
                        20
                    )}}`
                );
            else client.progress.increment();
        });

        client.deleter.on(MessageDeleterEvents.FailedDelete, (message) => {
            if (opts.verbose) Logger.error(`Failed to delete message ${message.id}.`);
            else client.progress.increment();
        });

        client.deleter.on(MessageDeleterEvents.Done, () => {
            if (!opts.verbose) {
                client.progress.update(client.deleter.approximate_total);
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
    .action(async (token) => {
        Logger.banner();

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
