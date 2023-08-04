import { Message, TextBasedChannel } from "discord.js-selfbot-v13";
import { Result } from "@sapphire/result";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter";

import { MessageSearcher } from "./";
import { DEFAULT_SEARCH_LIMIT, retry, sleep } from "@/shared";

export interface MessageDeleterOptions {
    deleteDelay: number;
}

export enum MessageDeleterEvents {
    Ready = "ready",
    Delete = "delete",
    FailedDelete = "failed_delete",
    ApproximateTotal = "approximate_total",
    Done = "done"
}

export type MessageDeleterEventMappings = {
    [MessageDeleterEvents.Ready]: (channel: TextBasedChannel) => void;
    [MessageDeleterEvents.Delete]: (message: Message) => void;
    [MessageDeleterEvents.FailedDelete]: (message: Message, error: any) => void;
    [MessageDeleterEvents.Done]: (channel: TextBasedChannel, deleted_messages: Message[]) => void;
};

export class MessageDeleter extends (EventEmitter as new () => TypedEmitter<MessageDeleterEventMappings>) {
    public deleted_messages: Message[] = [];
    public approximate_total: number = 0;

    public constructor(public readonly options: MessageDeleterOptions) {
        super();
    }

    public async deleteMessage(message: Message): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            const deleteResult = await retry(async () => {
                await sleep(this.options.deleteDelay);
                await message.delete();
            });

            if (deleteResult.isErr()) return Result.err(deleteResult.unwrapErr());

            return Result.ok();
        });
    }

    public async deleteChannelMessages(channel: TextBasedChannel): Promise<Result<Message[], any>> {
        return Result.fromAsync(async () => {
            const searcher = new MessageSearcher();

            const search = searcher.search(channel, channel.client.user?.id!, DEFAULT_SEARCH_LIMIT);

            const approximate_total = await searcher.getAproximateMessageCount(channel);

            if (approximate_total.isOk()) {
                this.approximate_total = approximate_total.unwrap();
            }

            this.deleted_messages = [];
            const current_deleted_mesasges: Message[] = [];

            this.emit(MessageDeleterEvents.Ready, channel);

            while (true) {
                const { value: message, done } = await search.next();

                if (done || !message) break;

                if (
                    [
                        "CALL",
                        "RECIPIENT_ADD",
                        "RECIPIENT_REMOVE",
                        "CHANNEL_NAME_CHANGE",
                        "CHANNEL_ICON_CHANGE",
                        "THREAD_STARTER_MESSAGE",
                        "GUILD_INVITE_REMINDER",
                        "CONTEXT_MENU_COMMAND",
                        "AUTO_MODERATION_ACTION",
                        "ROLE_SUBSCRIPTION_PURCHASE"
                    ].includes(message.type)
                )
                    continue;

                const deleted = await this.deleteMessage(message);

                current_deleted_mesasges.push(message);
                this.deleted_messages.push(message);

                if (deleted.isErr()) {
                    this.emit(MessageDeleterEvents.FailedDelete, message, deleted.unwrapErr());
                } else {
                    this.emit(MessageDeleterEvents.Delete, message);
                }

                await sleep(this.options.deleteDelay);
            }

            this.emit(MessageDeleterEvents.Done, channel, current_deleted_mesasges);

            return Result.ok(current_deleted_mesasges);
        });
    }
}
