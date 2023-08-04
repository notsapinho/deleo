import { Result } from "@sapphire/result";

export const retry = <T>(fn: any, tries = 3): Promise<Result<T, any>> => {
    return Result.fromAsync(async () => {
        const result = await Result.fromAsync<T>(fn);

        if (result.isOk()) return result;

        if (tries <= 0) return Result.err(result.unwrapErr());

        return retry(fn, tries - 1);
    });
};
