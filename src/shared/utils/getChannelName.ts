import { TextBasedChannel } from "discord.js-selfbot-v13";

export const getChannelName = (channel: TextBasedChannel) =>
    channel.type === "DM"
        ? channel.recipient.username
        : channel.type === "GROUP_DM"
        ? channel.name
            ? channel.name
            : channel.recipients.map((user) => user.username).join(", ")
        : channel.name;
