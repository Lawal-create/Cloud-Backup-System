import "reflect-metadata";
import "@app/http/controllers/users/user.controller";

import { EmailClient, EmailService } from "emails";
import Environment, { EnvConfig, envSchema, setupEnv } from "@app/internal/env";
import { Logger, RedisStore, defaultSerializers } from "@risemaxi/octonet";
import { UserRepository, UserService, UserToken } from "@app/users";
import chai, { expect } from "chai";
import {
  getAuthToken,
  newSignupDTO,
  signupUser,
  storeOtpKey,
} from "../helpers/user";
import { getError, getSuccess } from "../helpers";
import { mockEmailClient, mockSend } from "../helpers/email";

import APP_TYPES from "@app/config/types";
import { App } from "../../src/app";
import { Application } from "express";
import { AuthMiddleware } from "@app/http/middlewares/auth";
import { Container } from "inversify";
import { GenericMessage } from "@app/internal/http";
import INTERNAL_TYPES from "@app/internal/types";
import { Knex } from "knex";
import Redis from "ioredis";
import { StatusCodes } from "http-status-codes";
import chaiAsPromised from "chai-as-promised";
import { createPostgres } from "@app/config/postgres";
import { createRedis } from "@app/config/redis";
import faker from "faker";
import request from "supertest";

chai.use(chaiAsPromised);

const baseURL = "/api/v1/auth";

let container: Container;
let app: Application;
let env: EnvConfig;
let pg: Knex;
let redis: Redis;

beforeAll(async () => {
  const envvars = setupEnv(envSchema);
  const environment = new Environment(envvars);
  env = environment.env();
  const logger = new Logger({
    name: env.app_name,
    serializers: defaultSerializers(),
  });
  container = new Container();

  pg = await createPostgres(logger, env);

  container.bind<Knex>(INTERNAL_TYPES.KnexDB).toConstantValue(pg);
  container.bind<Logger>(INTERNAL_TYPES.Logger).toConstantValue(logger);
  container.bind<EnvConfig>(INTERNAL_TYPES.Env).toConstantValue(env);

  redis = await createRedis(logger, environment.env());
  container.bind<Redis>(INTERNAL_TYPES.Redis).toConstantValue(redis);
  const redisStore = new RedisStore(env.session_secret, redis);
  container
    .bind<RedisStore>(INTERNAL_TYPES.RedisStore)
    .toConstantValue(redisStore);
  container.bind<AuthMiddleware>(APP_TYPES.AuthMiddleware).to(AuthMiddleware);
  container.bind<UserRepository>(APP_TYPES.UserRepository).to(UserRepository);
  container.bind<UserService>(APP_TYPES.UserService).to(UserService);
  container
    .bind<EmailClient>(APP_TYPES.EmailClient)
    .toConstantValue(mockEmailClient);
  container.bind<EmailService>(APP_TYPES.EmailService).to(EmailService);

  app = new App(container, logger, env).server.build();
});

afterAll(async () => {
  await pg("users").del();
  await redis.quit();
});

beforeEach(() => {});

describe("AuthController#signup", () => {
  it("should fail if a user with this email already exists", async () => {
    const dto = newSignupDTO();
    signupUser(container, dto);
    const errorMessage = await getError(
      StatusCodes.CONFLICT,
      request(app).post(`${baseURL}/signup`).send(dto)
    );

    expect(errorMessage).to.eq("A user with the given details already exists");
  });

  it("should successfully sign up the user", async () => {
    const dto = newSignupDTO();
    const response = await getSuccess<UserToken>(
      request(app).post(`${baseURL}/signup`).send(dto)
    );

    expect(response.user.email).to.eq(dto.email);
    expect(response.user.first_name).to.eq(dto.first_name);
    expect(response.user.last_name).to.eq(dto.last_name);
    expect(response).to.haveOwnProperty("token");
  });
});

describe("AuthController#login", () => {
  it("should successfully login the user", async () => {
    const dto = newSignupDTO();
    await signupUser(container, dto);

    const response = await getSuccess<UserToken>(
      request(app).post(`${baseURL}/login`).send({
        email: dto.email,
        password: dto.password,
      })
    );

    expect(response.user.email).to.eq(dto.email);
    expect(response.user.first_name).to.eq(dto.first_name);
    expect(response.user.last_name).to.eq(dto.last_name);
    expect(response).to.haveOwnProperty("token");
  });

  it("should fail if the password is incorrect", async () => {
    const dto = newSignupDTO();
    await signupUser(container, dto);
    const password = faker.random.alphaNumeric(10);

    const errorMessage = await getError(
      StatusCodes.UNAUTHORIZED,
      request(app).post(`${baseURL}/login`).send({
        email: dto.email,
        password: password,
      })
    );

    expect(errorMessage).to.eq("Invalid email / password");
  });

  it("should fail if the email is incorrect", async () => {
    const dto = newSignupDTO();
    await signupUser(container, dto);
    const email = faker.internet.email();

    const errorMessage = await getError(
      StatusCodes.UNAUTHORIZED,
      request(app).post(`${baseURL}/login`).send({
        email,
        password: dto.password,
      })
    );

    expect(errorMessage).to.eq("Invalid email / password");
  });
});

describe("AuthController#requestForgotPassword", () => {
  it("should send an email if successful", async () => {
    const dto = newSignupDTO();
    await signupUser(container, dto);
    const resetURL = `https://localhost:${env.port}/api/v1/auth/reset-password`;

    const message = `Forgot password submit a Post request with your new password to: ${resetURL}
    .\n if you didn't forget your password, please ignore this email`;

    mockSend({
      from: "lawizyhal@gmail.com",
      subject: "Reset your password",
      to: dto.email,
      text: message,
    });

    const response = await getSuccess<GenericMessage>(
      request(app).get(`${baseURL}/forgot-password`).query({ email: dto.email })
    );

    expect(response.message).to.eq(
      "You will receive an email shortly if you have an account with us"
    );
  });
});

describe("AuthController#resetPassword", () => {
  it("should successfull reset a users password", async () => {
    const dto = newSignupDTO();
    const user = await signupUser(container, dto);

    await storeOtpKey(container, redis, env, user);
    const password = faker.random.alphaNumeric(10);

    const response = await getSuccess<UserToken>(
      request(app)
        .post(`${baseURL}/reset-password`)
        .send({ email: dto.email, password })
    );
    expect(response.user.email).to.eq(dto.email);
    expect(response.user.first_name).to.eq(dto.first_name);
    expect(response.user.last_name).to.eq(dto.last_name);
    expect(response).to.haveOwnProperty("token");
  });

  it("should fail if user does not exist", async () => {
    const dto = newSignupDTO();
    const user = await signupUser(container, dto);

    await storeOtpKey(container, redis, env, user);
    const password = faker.random.alphaNumeric(10);
    const email = faker.internet.email();

    const errorMessage = await getError(
      StatusCodes.BAD_REQUEST,
      request(app).post(`${baseURL}/reset-password`).send({ email, password })
    );
    expect(errorMessage).to.eq("Invalid user details");
  });

  it("should fail if tokenis invalid", async () => {
    const dto = newSignupDTO();
    const user = await signupUser(container, dto);

    const password = faker.random.alphaNumeric(10);

    const errorMessage = await getError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      request(app)
        .post(`${baseURL}/reset-password`)
        .send({ email: user.email, password })
    );
    expect(errorMessage).to.eq("Invalid or expired OTP sent");
  });
});

describe("AuthController#logout", () => {
  it("should successfully end user session", async () => {
    const dto = newSignupDTO();
    const user = await signupUser(container, dto);
    const token = await getAuthToken(container, "10s", user);
    const response = await getSuccess<GenericMessage>(
      request(app).post(`${baseURL}/logout`).set({
        Authorization: token,
      })
    );

    expect(response.message).to.eq("OK");
  });
});
