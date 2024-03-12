import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: { body: string }): Promise<{ statusCode: number; body: string }> => {
  const { username, password, email } = JSON.parse(event.body) as {
    username?: string;
    password?: string;
    email?: string;
  };

  const userPoolClientId = process.env.USER_POOL_CLIENT_ID;

  if (username === undefined || password === undefined || email === undefined) {
      return Promise.resolve({ statusCode: 400, body: 'Missing username, email or password' });
  }
  const schema = {
    "Username": username,
    "Password": password,
    "ClientId": userPoolClientId,
    "UserAttributes": [
      {
        Name: 'email',
        Value: email,
      },
    ],
  }

  const command = new SignUpCommand(schema);
  const response = await client.send(command);
  return { statusCode: 200, body: "user created" };
};