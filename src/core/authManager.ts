import { readFile, rm, writeFile } from "fs/promises";
import path from "path";
import os from "os";

import { Result } from "@sapphire/result";

export class AuthManager {
    public readonly cachePath: string = path.join(os.homedir(), "/.deleo_cached_token");

    public constructor() {}

    public async setToken(token: string): Promise<Result<string, any>> {
        return Result.fromAsync(async () => {
            await writeFile(this.cachePath, token);

            return Result.ok(token);
        });
    }

    public async getToken(): Promise<Result<string, any>> {
        return Result.fromAsync(async () => {
            const token = await readFile(this.cachePath, "utf-8");

            return Result.ok(token);
        });
    }

    public async deleteToken(): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            await rm(this.cachePath);

            return Result.ok();
        });
    }
}
