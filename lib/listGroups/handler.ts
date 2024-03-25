import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  const flag_group = await client.send(
    new ScanCommand({
      TableName: process.env.FLAG_TABLE_NAME,
    }),
  );

  if (flag_group === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(flag_group),
  };
};