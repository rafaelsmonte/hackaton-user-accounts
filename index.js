const AWS = require("aws-sdk");
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");
const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

exports.handler = async (event) => {
  console.log("event: ");
  console.log(event);
  console.log(event.rawPath);

  try {
    let body;

    if (typeof event.body === "string") {
      try {
        body = JSON.parse(event.body);
      } catch (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Invalid JSON format" }),
        };
      }
    } else {
      body = event.body;
    }

    if (event.rawPath === "/api/v1/auth/signup") {
      const { email, password, name } = body;

      await signUp(email, password, name);

      return {
        statusCode: 201,
        body: JSON.stringify({}),
      };
    } else if (event.rawPath === "/api/v1/auth/login") {
      const { email, password } = body;

      const result = await login(email, password);

      return {
        statusCode: 200,
        body: JSON.stringify({
          accessToken: result.getAccessToken().getJwtToken(),
        }),
      };
    } else if (path === "/logout") {
      // TODO implement logout flow
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Endpoint not found" }),
      };
    }
  } catch (error) {
    console.error("an error has occurred: ");
    console.error(error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        error: error.message || "Internal Server Error",
      }),
    };
  }
};

async function getUser(email) {
  try {
    const params = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
    };

    const data = await cognitoIdentityServiceProvider
      .adminGetUser(params)
      .promise();

    const userData = {
      Username: data.Username,
      Pool: new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: process.env.USER_POOL_ID,
        ClientId: process.env.CLIENT_ID,
      }),
    };

    return new AmazonCognitoIdentity.CognitoUser(userData);
  } catch (error) {
    if (error.code === "UserNotFoundException") {
      return null; // Return null if user does not exist
    } else {
      console.error("Error getting user by username: ", error);
      throw error; // Re-throw other errors
    }
  }
}

async function createUser(email, password, name) {
  try {
    const attributeList = [
      new AmazonCognitoIdentity.CognitoUserAttribute({
        Name: "name",
        Value: name,
      }),
      new AmazonCognitoIdentity.CognitoUserAttribute({
        Name: "email",
        Value: email,
      }),
    ];

    const signUpParams = {
      ClientId: process.env.CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: attributeList,
    };

    await cognitoIdentityServiceProvider.signUp(signUpParams).promise();

    const userData = {
      Username: email,
      Pool: new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: process.env.USER_POOL_ID,
        ClientId: process.env.CLIENT_ID,
      }),
    };

    return new AmazonCognitoIdentity.CognitoUser(userData);
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function confirmUser(username) {
  const params = {
    UserPoolId: process.env.USER_POOL_ID,
    Username: username,
  };

  try {
    await cognitoIdentityServiceProvider.adminConfirmSignUp(params).promise();
    console.log(`User ${username} has been confirmed successfully.`);
  } catch (error) {
    console.error("Error confirming user:", error);
    throw error;
  }
}

async function signUp(email, password, name) {
  let cognitoUser = await getUser(email);

  if (cognitoUser) {
    throw new CustomError("Email already registered", 400);
  } else {
    cognitoUser = await createUser(email, password, name);
    await confirmUser(email);
  }
}

async function login(email, password) {
  try {
    const userData = {
      Username: email,
      Pool: new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: process.env.USER_POOL_ID,
        ClientId: process.env.CLIENT_ID,
      }),
    };

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    return await new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(
        new AmazonCognitoIdentity.AuthenticationDetails({
          Username: email,
          Password: password,
        }),
        {
          onSuccess: (result) => resolve(result),
          onFailure: (err) => reject(err),
        }
      );
    });
  } catch (error) {
    console.error("Authentication failed:", error);
    throw new CustomError("Incorrect username or password", 401);
  }
}

async function logout(email) {}
