#! /usr/bin/env node

import { version, author, description } from "../package.json";

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { Client, Collection, DMChannel, TextBasedChannel, TextChannel } from "discord.js-selfbot-v13";
import figlet from "figlet";

import { MessageDeleter, MessageDeleterEvents, AuthManager } from "@/core";
import { Logger, truncate } from "@/shared";

const authManager = new AuthManager();

const banner = async () => {
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

const deleteMessagesFromOpenedDMs = async (client: Client, deleter: MessageDeleter) => {
    const channels = client.channels.cache.filter((channel) => ["DM", "GROUP_DM"].includes(channel.type)) as Collection<
        string,
        DMChannel | TextChannel
    >;

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

    for (const channel_id of channels_to_delete) {
        const channel = channels.get(channel_id);

        await deleter.deleteChannelMessages(channel);
    }
};

const deleteMessagesFromChannel = async (client: Client, deleter: MessageDeleter) => {
    const { channel_id } = await inquirer.prompt({
        name: "channel_id",
        type: "input",
        message: chalk`{white Enter the channel id {rgb(237,112,20).bold >>}}`,
        prefix: Logger.tag,
        transformer: (input) => input
    });

    const channel = (await client.channels.fetch(channel_id).catch(() => null)) as TextBasedChannel;

    if (!channel) {
        Logger.error("Invalid channel id.");
        process.exit();
    }

    await deleter.deleteChannelMessages(channel);
};

const program = new Command();

program
    .name("deleo")
    .description(description)
    .version(version, "-v, --version", "Output the current version")
    .option("-t, --token <token>", "Your discord token")
    .option("-d, --delete-delay <delay>", "Delay between each message deletion in ms", "300")
    .addHelpCommand("help [command]", "Display help for command")
    .helpOption("-h, --help", "Display help for command");

program
    .command("auth")
    .description("Save your discord token.")
    .argument("<token>", "Your discord token")
    .action(async (token) => {
        void banner();

        const cachedToken = await authManager.getToken();

        if (cachedToken.isOk()) {
            const { confirm } = await inquirer.prompt({
                name: "confirm",
                type: "confirm",
                message: chalk`{white Are you sure you want to overwrite your saved token?}`,
                prefix: Logger.tag
            });

            if (!confirm) return;

            await authManager.setToken(token);

            Logger.success("Successfully saved the new token!");
        } else {
            await authManager.setToken(token);

            Logger.success("Successfully saved the token!");
        }
    });

program
    .command("delete")
    .description("Delete messages from open DMs or a specified channel.")
    .action(async () => {
        void banner();

        const opts = program.opts();

        let token: string = "";

        const cachedToken = await authManager.getToken();

        if (cachedToken.isOk()) {
            token = cachedToken.unwrap();
        } else if (opts.token) {
            token = opts.token;
        } else {
            const promptResult = await inquirer.prompt({
                name: "token",
                type: "input",
                message: chalk`{white Enter your token {rgb(237,112,20).bold >>}}`,
                prefix: Logger.tag,
                transformer: (input, _, flags) => (flags.isFinal ? truncate(input, 10) : input)
            });

            token = promptResult.token;
        }

        const client = new Client({
            checkUpdate: false
        });

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

            const deleter = new MessageDeleter({
                deleteDelay: Number(opts.deleteDelay)
            });

            deleter.on(MessageDeleterEvents.Ready, (channel) => {
                Logger.setTerminalTitle(
                    `| Deleted ${deleter.deleted_messages.length}/${deleter.approximate_total} | Deleting ${
                        channel.type === "DM" ? channel.recipient.tag : channel.name
                    } `
                );

                Logger.log(
                    chalk`{white Deleting messages from {yellow.bold ${
                        channel.type === "DM" ? channel.recipient.tag : channel.name
                    }}...}`
                );
            });

            deleter.on(MessageDeleterEvents.Delete, (message) => {
                Logger.setTerminalTitle(
                    `| Deleted ${deleter.deleted_messages.length}/${deleter.approximate_total} | Deleting ${
                        message.channel.type === "DM" ? message.channel.recipient.tag : message.channel.name
                    } `
                );

                Logger.log(
                    chalk`{white Deleted {yellow.bold ${message.id}} - ${message.author.tag}: ${truncate(
                        message.content,
                        20
                    )}}`
                );
            });

            deleter.on(MessageDeleterEvents.FailedDelete, (message) => {
                Logger.setTerminalTitle(
                    `| Deleted ${deleter.deleted_messages.length}/${deleter.approximate_total} | Deleting ${
                        message.channel.type === "DM" ? message.channel.recipient.tag : message.channel.name
                    }}`
                );

                Logger.error(`Failed to delete message ${message.id}.`);
            });

            deleter.on(MessageDeleterEvents.ApproximateTotal, (total) => {
                if (total === 0) Logger.warn("Failed to get the approximate total of messages to delete.");
                else Logger.log(chalk`{white Deleting an approximate total of messages: {yellow.bold ${total}}}`);
            });

            deleter.on(MessageDeleterEvents.Done, (channel, deleted_messages) => {
                Logger.log(
                    chalk`{white Deleted {yellow.bold ${deleted_messages.length}} messages from {yellow.bold ${
                        channel.type === "DM" ? channel.recipient.tag : channel.name
                    }}}`
                );
            });

            switch (option) {
                case "deleteMessagesFromOpenedDMs":
                    {
                        await deleteMessagesFromOpenedDMs(client, deleter);
                    }
                    break;
                case "deleteMessagesFromChannel":
                    {
                        await deleteMessagesFromChannel(client, deleter);
                    }
                    break;
            }

            Logger.success("Done!");

            client.destroy();
            process.exit();
        });

        try {
            Logger.warn("Logging in...");

            await client.login(token);
        } catch (error) {
            Logger.error("Invalid token.");
            process.exit();
        }
    });

program.parse(process.argv);
