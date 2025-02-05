const { handler } = require("./index");
const AWS = require("aws-sdk");
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

process.env.AWS_REGION = "us-east-1";
process.env.USER_POOL_ID = "test-user-pool-id";
process.env.CLIENT_ID = "test-client-id";
process.env.AWS_ACCESS_KEY_ID = "mockAccessKey";
process.env.AWS_SECRET_ACCESS_KEY = "mockSecretKey";

AWS.config.update({
  region: process.env.AWS_REGION,
  credentials: new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
});

jest.mock("aws-sdk");
jest.mock("amazon-cognito-identity-js");

describe("Lambda Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle signup successfully", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue({ code: "UserNotFoundException" }),
      }));

    AWS.CognitoIdentityServiceProvider.prototype.signUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    AWS.CognitoIdentityServiceProvider.prototype.adminConfirmSignUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({});
  });

  it("should handle login successfully", async () => {
    const event = {
      rawPath: "/api/v1/auth/login",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
      }),
    };

    const mockCognitoUser = {
      authenticateUser: jest
        .fn()
        .mockImplementation((authDetails, callbacks) => {
          callbacks.onSuccess({
            getAccessToken: () => ({ getJwtToken: () => "mockAccessToken" }),
          });
        }),
    };

    AmazonCognitoIdentity.CognitoUserPool.mockImplementation(() => ({}));
    AmazonCognitoIdentity.CognitoUser.mockImplementation(() => mockCognitoUser);

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ accessToken: "mockAccessToken" });
  });

  it("should return 400 for invalid JSON", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: "invalid-json",
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "Invalid JSON format" });
  });

  it("should return 404 for unknown endpoint", async () => {
    const event = {
      rawPath: "/unknown",
      body: JSON.stringify({}),
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "Endpoint not found" });
  });

  it("should return 400 for duplicate email during signup", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: "Email already registered",
    });
  });

  it("should return 401 for incorrect login credentials", async () => {
    const event = {
      rawPath: "/api/v1/auth/login",
      body: JSON.stringify({
        email: "test@example.com",
        password: "WrongPassword",
      }),
    };

    const mockCognitoUser = {
      authenticateUser: jest
        .fn()
        .mockImplementation((authDetails, callbacks) => {
          callbacks.onFailure({ message: "Incorrect username or password" });
        }),
    };

    AmazonCognitoIdentity.CognitoUserPool.mockImplementation(() => ({}));
    AmazonCognitoIdentity.CognitoUser.mockImplementation(() => mockCognitoUser);

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({
      error: "Incorrect username or password",
    });
  });

  it("should handle errors in getUser other than UserNotFoundException", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest
          .fn()
          .mockRejectedValue(new Error("Internal Server Error")),
      }));

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: "Internal Server Error" });
  });

  it("should handle errors in createUser", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue({ code: "UserNotFoundException" }),
      }));

    AWS.CognitoIdentityServiceProvider.prototype.signUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue(new Error("Signup failed")),
      }));

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: "Signup failed" });
  });

  it("should handle errors in confirmUser", async () => {
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue({ code: "UserNotFoundException" }),
      }));

    AWS.CognitoIdentityServiceProvider.prototype.signUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    AWS.CognitoIdentityServiceProvider.prototype.adminConfirmSignUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue(new Error("Confirmation failed")),
      }));

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: "Confirmation failed" });
  });
});
