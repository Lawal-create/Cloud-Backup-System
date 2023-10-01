import "module-alias/register";

import { Logger, defaultSerializers } from "@risemaxi/octonet";

import Postgrator from "postgrator";
import { envSchema as env } from "../src/internal/env";
import { excludeProperties } from "../src/internal/postgres";
import knex from "knex";
import path from "path";

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
      database:
        env.node_env === "test" ? env.test_postgres_db : env.postgres_db,
      ssl:
        // env.is_production ? { rejectUnauthorized: false } :
        false,
      application_name: env.app_name,
    },
    searchPath: [env.postgres_schema],
    postProcessResponse: (result, queryContext) => {
      return excludeProperties(result, queryContext);
    },
  });

  pg.on("error", (err) => logger.error(err));
  const postgrator = new Postgrator({
    migrationPattern: path.join(process.cwd(), "db/test/*"),
    driver: "pg",
    database: env.postgres_db,
    schemaTable: "schema_migrations",
    currentSchema: "test",
    execQuery: (query) => pg.raw(query),
  });
  await pg.raw(
    `create schema if not exists test authorization ${env.postgres_user};`
  );
  await postgrator.migrate();
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
