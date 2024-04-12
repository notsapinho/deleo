import EventEmitter from "events";
import type { Message, TextBasedChannel } from "discord.js-selfbot-v13";

import { Result } from "@sapphire/result";
import TypedEmitter from "typed-emitter";

import { DEFAULT_SEARCH_LIMIT } from "@/shared";
import { retry, sleep } from "@/shared/utils";
import { MessageSearcher } from "./";

export interface MessageDeleterOptions {
    deleteDelay: number;
}

export enum MessageDeleterEvents {
    Ready = "ready",
    Delete = "delete",
    FailedDelete = "failedDelete",
    Done = "done"
}

export type MessageDeleterEventMappings = {
    [MessageDeleterEvents.Ready]: (channel: TextBasedChannel) => void;
    [MessageDeleterEvents.Delete]: (message: Message) => void;
    [MessageDeleterEvents.FailedDelete]: (message: Message, error: any) => void;
    [MessageDeleterEvents.Done]: (
        channel: TextBasedChannel,
        deletedMessages: Message[]
    ) => void;
};

export class MessageDeleter extends (EventEmitter as new () => TypedEmitter<MessageDeleterEventMappings>) {
    public deletedMessages: Message[] = [];
    public approximateTotal: number = 0;

    public constructor(public readonly options: MessageDeleterOptions) {
        super();
    }

    public async deleteMessage(message: Message): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            const deleteResult = await retry(async () => {
                await sleep(this.options.deleteDelay);
                await message.delete();
            });

            if (deleteResult.isErr())
                return Result.err(deleteResult.unwrapErr());

            return Result.ok();
        });
    }

    public async deleteChannelMessages(
        channel: TextBasedChannel
    ): Promise<Result<Message[], any>> {
        return Result.fromAsync(async () => {
            const searcher = new MessageSearcher();

            const search = searcher.search(
                channel,
                channel.client.user?.id!,
                DEFAULT_SEARCH_LIMIT
            );

            const approximateTotal =
                await searcher.getAproximateMessageCount(channel);

            if (approximateTotal.isOk()) {
                this.approximateTotal = approximateTotal.unwrap();
            }

            this.deletedMessages = [];
            const currentDeletedMessages: Message[] = [];

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

                currentDeletedMessages.push(message);
                this.deletedMessages.push(message);

                if (deleted.isErr()) {
                    this.emit(
                        MessageDeleterEvents.FailedDelete,
                        message,
                        deleted.unwrapErr()
                    );
                } else {
                    this.emit(MessageDeleterEvents.Delete, message);
                }

                await sleep(this.options.deleteDelay);
            }

            this.emit(
                MessageDeleterEvents.Done,
                channel,
                currentDeletedMessages
            );

            return Result.ok(currentDeletedMessages);
        });
    }
}
