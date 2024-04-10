import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: { body: string }): Promise<{ statusCode: number; body: string }> => {
  const { username, password, email } = JSON.parse(event.body) as {
    username?: string;
    password?: string;
    email?: string;
  };
  if (username === undefined || password === undefined || email === undefined) {
      return Promise.resolve({ statusCode: 400, body: 'Missing username, email or password' });
  }

  await client.send(new SignUpCommand({
    "Username": username,
    "Password": password,
    "ClientId": process.env.USER_POOL_CLIENT_ID,
    "UserAttributes": [
      {
        Name: 'email',
        Value: email,
      },
    ],
  }));

  return { 
    statusCode: 200, 
    body: JSON.stringify({
      username,
      password,
      email
    }) 
  };
};