import type { GroupDMChannel, TextBasedChannel } from "discord.js-selfbot-v13";

export const getChannelName = (channel: TextBasedChannel) =>
    channel.type === "DM"
        ? channel.recipient.username
        : (channel as unknown as GroupDMChannel).type === "GROUP_DM"
          ? channel.name
              ? channel.name
              : (channel as unknown as GroupDMChannel).recipients
                    .map((user) => user.username)
                    .join(", ")
          : channel.name;
