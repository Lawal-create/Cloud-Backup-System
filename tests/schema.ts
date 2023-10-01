import "module-alias/register";

import { Logger, defaultSerializers } from "@risemaxi/octonet";

import { envSchema as env } from "../src/internal/env";
import knex from "knex";

const logger = new Logger({
  name: "test-setup",
  serializers: defaultSerializers(),
});

async function migrate() {
  const pg = knex({
    client: "pg",
    connection: {
      host: env.postgres_host,
      port: env.postgres_port,
      user: env.postgres_user,
      password: env.postgres_password,
      database: env.postgres_db,
      ssl: env.is_production,
      application_name: env.app_name,
    },
  });

  return await pg.raw(
    `create schema if not exists ${env.postgres_schema} authorization ${env.postgres_user};`
  );
}

migrate().then(
  () => {
    logger.log("created test db");
    process.exit(0);
  },
  (err) => {
    logger.error(err);
    process.exit(1);
  }
);
