import type { Message, TextBasedChannel } from "discord.js-selfbot-v13";

import { Result } from "@sapphire/result";

export class MessageSearcher {
    private offsetID: string;
    private lastLimit: number = 0;

    public constructor() {}

    public async *search(
        channel: TextBasedChannel,
        userId: string,
        limit: number = 100
    ): AsyncGenerator<Message, void, void> {
        const fetch = await this.fetch(channel, limit);

        if (fetch.isErr()) return;

        const messages = fetch.unwrap();

        if (messages.length === 0) return;

        while (messages.length > 0) {
            const message = messages.shift()!;

            if (message.author.id === userId) yield message;

            if (messages.length === 0) {
                const fetch = await this.fetchTillUser(channel, userId, limit);

                if (fetch.isErr()) break;

                messages.push(...fetch.unwrap());
            }
        }
    }

    public async getAproximateMessageCount(
        channel: TextBasedChannel
    ): Promise<Result<number, any>> {
        return Result.fromAsync(async () => {
            //@ts-ignore
            const search = await channel.messages.search({
                channels: [channel.id],
                authors: [channel.client.user!.id],
                limit: 25,
                sortBy: "timestamp",
                sortOrder: "desc"
            });

            return Result.ok(search.total);
        });
    }

    public async fetchTillUser(
        channel: TextBasedChannel,
        userId: string,
        limit: number = 100
    ): Promise<Result<Message[], any>> {
        return Result.fromAsync(async () => {
            const fetch = await this.fetch(channel, limit);

            if (fetch.isErr()) return Result.err("No messages found");

            const messages = fetch.unwrap();

            if (messages.length === 0) return Result.err("No messages found");

            const filtered = messages.filter(
                (message) => message.author.id === userId
            );

            if (filtered.length > 0) return Result.ok(filtered);

            return this.fetchTillUser(channel, userId, limit);
        });
    }

    public async fetch(
        channel: TextBasedChannel,
        limit: number = 100
    ): Promise<Result<Message[], any>> {
        return Result.fromAsync(async () => {
            if (["DM", "GROUP_DM"].includes(channel.type)) {
                const messages = await channel.messages.fetch({
                    limit,
                    before: this.offsetID
                });

                if (messages.size === 0) return Result.ok([]);

                this.offsetID = messages.lastKey()!;

                return Result.ok([...messages.values()]);
            } else {
                limit = 25;

                //@ts-ignore
                const search = await channel.messages.search({
                    channels: [channel.id],
                    authors: [channel.client.user!.id],
                    limit,
                    offset: this.lastLimit,
                    sortBy: "timestamp",
                    sortOrder: "desc"
                });

                if (search.total === 0) return Result.ok([]);

                // Yeah discord is weird
                if (search.messages.size === 0) {
                    this.lastLimit += limit;
                    return this.fetch(channel, limit);
                }

                this.lastLimit += limit;

                return Result.ok([...search.messages.values()]);
            }
        });
    }
}
