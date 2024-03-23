import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { jwtDecode } from "jwt-decode";

const client = new DynamoDBClient({});

export const handler = async (event: any) => {
  const token = event.headers.Authorization.split(' ')[1];
  const decoded = jwtDecode(token);
  const sub = decoded['sub']
  const username = decoded['cognito:username'];

  const { Item } = await client.send(
    new GetItemCommand({
      TableName: process.env.USER_TABLE_NAME,
      Key: {
        PK: { S: sub },
        SK: { S: username },
      },
    }),
  );

  if (Item) {
    const newToken: number = Item.token - 1;
    Item.token = { N: newToken }; // Update field1
  }

  return {
      statusCode: 200,
      body: newToken
  };
};