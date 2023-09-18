import "module-alias/register";
import "reflect-metadata";
import "./http/controllers";

import Environment, { EnvConfig, envSchema, setupEnv } from "@app/internal/env";
import { Logger, RedisStore, defaultSerializers } from "@risemaxi/octonet";

import { App } from "./app";
import { Container } from "inversify";
import INTERNAL_TYPES from "./internal/types";
import { Knex } from "knex";
import Redis from "ioredis";
import { createPostgres } from "@app/config/postgres";
import { createRedis } from "@app/config/redis";
import { getRouteInfo } from "inversify-express-utils";
import http from "http";
import prettyjson from "prettyjson";

async function isHealthy(redis: Redis, pg: Knex) {
  if (redis.status !== "ready") {
    throw new Error("redis is not ready");
  }

  try {
    await pg.raw("select now()");
  } catch (err) {
    throw new Error("postgres is not ready");
  }
}

const start = async () => {
  const envvars = setupEnv(envSchema);
  const environment = new Environment(envvars);
  const env = environment.env();

  const logger = new Logger({
    name: env.app_name,
    serializers: defaultSerializers("password", "password_hash"),
  });
  try {
    const container = new Container();
    container.bind<Logger>(INTERNAL_TYPES.Logger).toConstantValue(logger);
    container.bind<EnvConfig>(INTERNAL_TYPES.Env).toConstantValue(env);

    // setup postgres
    const pg = await createPostgres(logger, env);
    container.bind<Knex>(INTERNAL_TYPES.KnexDB).toConstantValue(pg);
    logger.log("successfully connected to postgres and has run migration");

    // setup in-memory store
    const redis = await createRedis(logger, env);
    container.bind<Redis>(INTERNAL_TYPES.Redis).toConstantValue(redis);

    const redisStore = new RedisStore(env.session_secret, redis);
    container
      .bind<RedisStore>(INTERNAL_TYPES.RedisStore)
      .toConstantValue(redisStore);
    logger.log("successfully connected to redis");

    const app = new App(container, logger, env, () => isHealthy(redis, pg));

    const appServer = app.server.build();

    // start server
    const httpServer = http.createServer(appServer);
    httpServer.listen(env.port);
    httpServer.on("listening", () => {
      logger.log(`${env.app_name} listening on ${env.port}`);
      const routeInfo = getRouteInfo(container);
      console.log(
        prettyjson.render(
          { routes: routeInfo },
          { keysColor: "green", dashColor: "blue", stringColor: "grey" }
        )
      );
    });

    process.on("SIGTERM", async () => {
      logger.log("exiting aplication...");

      await redis.quit();

      httpServer.close(() => {
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error(err);
  }
};

start();
