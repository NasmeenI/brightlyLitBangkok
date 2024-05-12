import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

interface brightly {
  pir: number,
  light: number,
  place: string;
}

export const handler = async (event: {
  body: string
}): Promise<{ statusCode: number; body: string }> => {
  const body: brightly = JSON.parse(event.body);

  if (body === undefined) {
    return {
      statusCode: 400,
      body: 'bad request',
    };
  }

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
  if (getItemResponse.Item === undefined || getItemResponse.Item.qsLight.L === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  const qsLight = getItemResponse.Item.qsLight.L;


  return {
    statusCode: 200,
    body: JSON.stringify({ "test": "test" }),
  };
};