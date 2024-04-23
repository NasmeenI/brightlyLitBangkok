import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});

interface FlagGroups {
  name: string;
  flags: string[];
}

export const handler = async (event: {
  body: string;
}): Promise<{ statusCode: number; body: string }> => {
  const content : FlagGroups = JSON.parse(event.body);

  if (content === undefined) {
    return {
      statusCode: 400,
      body: 'You must pass a content',
    };
  }

  const flagGroupsId = uuidv4();

  const params = {
    TableName: process.env.FLAG_TABLE_NAME,
    Item: {
      PK: { S: "flagGroups" },
      SK: { S: flagGroupsId },
      name: { S: content.name }, // Group name
      flags: { L: content.flags.map(str => ({ S : str})) } // Flags
    },
  };

  await client.send(new PutItemCommand(params));
  
  return {
    statusCode: 200,
    body: JSON.stringify({ flagGroupsId }),
  };
};