// const AWS = require("aws-sdk");
// const awsMock = require("aws-sdk-mock");
// const { handler } = require("./index");

// // ✅ Ensure environment variables are set before requiring AWS SDK
// process.env.AWS_REGION = "us-east-1";
// process.env.USER_POOL_ID = "test-user-pool-id";
// process.env.CLIENT_ID = "test-client-id";
// process.env.AWS_ACCESS_KEY_ID = "mockAccessKey";
// process.env.AWS_SECRET_ACCESS_KEY = "mockSecretKey";

// // ✅ Explicitly configure AWS SDK before anything else
// AWS.config.update({
//   region: process.env.AWS_REGION,
//   credentials: new AWS.Credentials({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   }),
// });

// // ✅ Ensure aws-sdk-mock is using the correct AWS SDK version
// awsMock.setSDKInstance(AWS);

// describe("Lambda Handler", () => {
//   beforeAll(() => {
//     awsMock.mock(
//       "CognitoIdentityServiceProvider",
//       "adminGetUser",
//       (params, callback) => {
//         if (params.Username === "existing@example.com") {
//           callback(null, { Username: "existing@example.com" });
//         } else {
//           callback({ code: "UserNotFoundException" }, null);
//         }
//       }
//     );

//     awsMock.mock(
//       "CognitoIdentityServiceProvider",
//       "signUp",
//       (params, callback) => {
//         callback(null, {});
//       }
//     );

//     awsMock.mock(
//       "CognitoIdentityServiceProvider",
//       "adminConfirmSignUp",
//       (params, callback) => {
//         callback(null, {});
//       }
//     );
//   });

//   afterAll(() => {
//     awsMock.restore("CognitoIdentityServiceProvider");
//   });

//   it("should return 400 if body is invalid JSON", async () => {
//     const event = { body: "{invalidJSON" };
//     const response = await handler(event);
//     expect(response.statusCode).toBe(400);
//     expect(response.body).toContain("Invalid JSON format");
//   });

//   it("should return 201 on successful signup", async () => {
//     const event = {
//       rawPath: "/api/v1/auth/signup",
//       body: JSON.stringify({
//         email: "new@example.com",
//         password: "Test123!",
//         name: "User",
//       }),
//     };
//     const response = await handler(event);
//     expect(response.statusCode).toBe(201);
//   });

//   it("should return 400 if email is already registered", async () => {
//     const event = {
//       rawPath: "/api/v1/auth/signup",
//       body: JSON.stringify({
//         email: "existing@example.com",
//         password: "Test123!",
//         name: "User",
//       }),
//     };
//     const response = await handler(event);
//     expect(response.statusCode).toBe(400);
//     expect(response.body).toContain("Email already registered");
//   });

//   it("should return 404 for an unknown route", async () => {
//     const event = { rawPath: "/unknown-route", body: "{}" };
//     const response = await handler(event);
//     expect(response.statusCode).toBe(404);
//     expect(response.body).toContain("Endpoint not found");
//   });
// });

const { handler } = require("./index"); // Update the path to your Lambda file
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

// Mock AWS SDK and Cognito
jest.mock("aws-sdk");
jest.mock("amazon-cognito-identity-js");

describe("Lambda Handler", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("should handle signup successfully", async () => {
    // Mock event for signup
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    // Mock Cognito responses
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

    // Call the handler
    const result = await handler(event);

    // Assertions
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toEqual({});
  });

  it("should handle login successfully", async () => {
    // Mock event for login
    const event = {
      rawPath: "/api/v1/auth/login",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
      }),
    };

    // Mock Cognito responses
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

    // Call the handler
    const result = await handler(event);

    // Assertions
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ accessToken: "mockAccessToken" });
  });

  it("should return 400 for invalid JSON", async () => {
    // Mock event with invalid JSON
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: "invalid-json",
    };

    // Call the handler
    const result = await handler(event);

    // Assertions
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: "Invalid JSON format" });
  });

  it("should return 404 for unknown endpoint", async () => {
    // Mock event for unknown endpoint
    const event = {
      rawPath: "/unknown",
      body: JSON.stringify({}),
    };

    // Call the handler
    const result = await handler(event);

    // Assertions
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ message: "Endpoint not found" });
  });

  it("should return 400 for duplicate email during signup", async () => {
    // Mock event for signup
    const event = {
      rawPath: "/api/v1/auth/signup",
      body: JSON.stringify({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      }),
    };

    // Mock Cognito responses
    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    // Call the handler
    const result = await handler(event);

    // Assertions
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: "Email already registered",
    });
  });

  it("should return 401 for incorrect login credentials", async () => {
    // Mock event for login
    const event = {
      rawPath: "/api/v1/auth/login",
      body: JSON.stringify({
        email: "test@example.com",
        password: "WrongPassword",
      }),
    };

    // Mock Cognito responses
    const mockCognitoUser = {
      authenticateUser: jest
        .fn()
        .mockImplementation((authDetails, callbacks) => {
          callbacks.onFailure({ message: "Incorrect username or password" });
        }),
    };

    AmazonCognitoIdentity.CognitoUserPool.mockImplementation(() => ({}));
    AmazonCognitoIdentity.CognitoUser.mockImplementation(() => mockCognitoUser);

    // Call the handler
    const result = await handler(event);

    // Assertions
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

    // Mock adminGetUser to throw an error
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

    // Mock adminGetUser to simulate user not found
    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue({ code: "UserNotFoundException" }),
      }));

    // Mock signUp to throw an error
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

    // Mock adminGetUser to simulate user not found
    AWS.CognitoIdentityServiceProvider.prototype.adminGetUser = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockRejectedValue({ code: "UserNotFoundException" }),
      }));

    // Mock signUp to succeed
    AWS.CognitoIdentityServiceProvider.prototype.signUp = jest
      .fn()
      .mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({}),
      }));

    // Mock adminConfirmSignUp to throw an error
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
