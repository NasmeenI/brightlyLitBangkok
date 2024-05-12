import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

interface brightly {
  pir: number,
  light: number,
  place: string;
}

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
  if (getItemResponse.Item === undefined || getItemResponse.Item.qsLight.L === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  const data = getItemResponse.Item.data.L;
  const currentData = data[data.length - 1].M;
  const pir = parseInt(currentData.pir.N?.toString());
  const light = parseInt(currentData.light.N?.toString());

  let result = false;
  if(pir > 10 && pir < 20 && light > 10 && light < 20) result = true;
  return {
    statusCode: 200,
    body: JSON.stringify({ result: result }),
  };
};