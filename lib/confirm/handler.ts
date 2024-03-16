import { CognitoIdentityProviderClient, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new CognitoIdentityProviderClient({});
const clientDB = new DynamoDBClient({});

export const handler = async (event: { body: string }): Promise<{ statusCode: number; body: string }> => {
  const { username, code } = JSON.parse(event.body) as { username?: string; code?: string };
  
  if (username === undefined || code === undefined) {
    return Promise.resolve({ statusCode: 400, body: 'Missing username or confirmation code' });
  }

  const userPoolClientId = process.env.USER_POOL_CLIENT_ID;

  await client.send(
    new ConfirmSignUpCommand({
      ClientId: userPoolClientId,
      Username: username,
      ConfirmationCode: code,
    }),
  );

  const userId = uuidv4();

  await clientDB.send(
    new PutItemCommand({
      TableName: process.env.USER_TABLE_NAME,
      Item: {
        PK: { S: userId },
        username: { S: username },
        token: { N: "10" },
      },
    }),
  );

  return { statusCode: 200, body: 'User confirmed' };
};