import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getItemResponse = await client.send(
    new GetItemCommand({
      TableName: process.env.BRIGHTLY_TABLE_NAME,
      Key: {
        PK: { S: formattedDate },
      },
    })
  );
  if (getItemResponse.Item === undefined || getItemResponse.Item.data.L === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  const data = getItemResponse.Item.data.L;
  const currentStatus = data[data.length - 1].M;
  if (currentStatus === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      "pir": parseInt(currentStatus.pir.N.toString()),
      "light": parseInt(currentStatus.light.N?.toString()),
      "timestamp": parseInt(currentStatus.timestamp.N?.toString())
    }),
  };
};