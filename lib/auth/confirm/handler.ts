import { CognitoIdentityProviderClient, ConfirmSignUpCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { jwtDecode } from "jwt-decode";

const client = new CognitoIdentityProviderClient({});
const clientDB = new DynamoDBClient({});

export const handler = async (event: { body: string }): Promise<{ statusCode: number; body: string }> => {
  const { username, password, code } = JSON.parse(event.body) as { username?: string; password?: string; code?: string };
  
  if (username === undefined || password === undefined || code === undefined) {
    return Promise.resolve({ statusCode: 400, body: 'Missing username or confirmation code' });
  }

  // confirm in user pool client
  await client.send(
    new ConfirmSignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    }),
  );

  // get idToken from cognito 
  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  );
  const idToken = result.AuthenticationResult?.IdToken;
  if (idToken === undefined) {
    return Promise.resolve({ statusCode: 401, body: 'Authentication failed' });
  }

  // get sub
  const decoded = jwtDecode(idToken);
  const sub = decoded['sub']
  if (sub === undefined) {
    return Promise.resolve({ statusCode: 401, body: 'Authentication failed' });
  }

  await clientDB.send(
    new PutItemCommand({
      TableName: process.env.USER_TABLE_NAME,
      Item: {
        PK: { S: sub },
        SK: { S: username },
        token: { N: "10" },
      },
    }),
  );

  return { 
    statusCode: 200, 
    body: JSON.stringify({
      username,
      token: 10
    })
  };
};