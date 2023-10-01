import { AuthTokenDTO, TokenDTO, UpdateTokens } from "./user.model";
import { compare, hash } from "bcrypt";
import { inject, injectable } from "inversify";

import { EnvConfig } from "@app/internal/env";
import INTERNAL_TYPES from "@app/internal/types";
import { RedisStore } from "@risemaxi/octonet";
import crypto from "crypto";

@injectable()
export class UserService {
  @inject(INTERNAL_TYPES.Env) private env: EnvConfig;
  @inject(INTERNAL_TYPES.RedisStore) private redisStore: RedisStore;

  getHash(password: string) {
    return hash(password, 10);
  }

  validatePassword(password: string, hash: string) {
    return compare(password, hash);
  }

  getTokenHash(key: string) {
    return crypto
      .createHmac("sha256", this.env.session_secret)
      .update(key)
      .digest("hex");
  }

  getEmailMessage(protocol: string) {
    const resetURL = `${protocol}://localhost:${this.env.port}/api/v1/auth/reset-password`;

    const message = `Forgot password submit a Post request with your new password to: ${resetURL}
    .\n if you didn't forget your password, please ignore this email`;

    return message;
  }

  async getAuthToken(dto: AuthTokenDTO) {
    const tokensId = `AUTH_TOKENS::${dto.id}`;

    const timestamp = Date.now();

    const token = await this.commissionNewToken(dto, timestamp);
    let tokens = await this.getExistingTokens(tokensId);

    if (!tokens) {
      tokens = [];
    }

    await this.updateCommissionedTokens({
      token,
      tokens,
      timestamp,
      tokens_id: tokensId,
    });

    return token;
  }

  async logout(userId: string) {
    const tokensId = `AUTH_TOKENS::${userId}`;
    const tokensIdHash = this.getTokenHash(tokensId);
    const tokens = await this.redisStore.peek<TokenDTO[]>(tokensIdHash);

    if (!tokens) {
      return;
    }

    for (const token of tokens) {
      const hash = this.getTokenHash(`${userId}:${token.timestamp}`);
      await this.redisStore.decommission(hash);
    }

    await this.redisStore.decommission(tokensIdHash);
  }

  private async commissionNewToken(
    dto: AuthTokenDTO,
    timestamp: number
  ): Promise<string> {
    return await this.redisStore.commision(
      `${dto.id}:${timestamp}`,
      dto,
      `${this.env.session_ttl}s`
    );
  }

  private async updateCommissionedTokens(dto: UpdateTokens): Promise<string> {
    const { timestamp, token, tokens_id, tokens } = dto;

    return await this.redisStore.commision<TokenDTO[]>(
      tokens_id,
      [...tokens, { timestamp, token }],
      "30d"
    );
  }

  private async getExistingTokens(id: string) {
    return (
      (await this.redisStore.peek<TokenDTO[]>(this.getTokenHash(id))) || []
    );
  }
}
