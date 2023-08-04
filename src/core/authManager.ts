import { readFile, rm, writeFile } from "fs/promises";
import path from "path";
import os from "os";

import { Result } from "@sapphire/result";

export class AuthManager {
    public static readonly cachePath: string = path.join(os.homedir(), "/.deleo_cached_token");

    public static async setToken(token: string): Promise<Result<string, any>> {
        return Result.fromAsync(async () => {
            await writeFile(AuthManager.cachePath, token);

            return Result.ok(token);
        });
    }

    public static async getToken(): Promise<Result<string, any>> {
        return Result.fromAsync(async () => {
            const token = await readFile(AuthManager.cachePath, "utf-8");

            return Result.ok(token);
        });
    }

    public static async deleteToken(): Promise<Result<any, any>> {
        return Result.fromAsync(async () => {
            await rm(AuthManager.cachePath);

            return Result.ok();
        });
    }
}
