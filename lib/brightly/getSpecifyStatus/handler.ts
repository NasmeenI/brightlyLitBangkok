import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

export const handler = async (event : {
  pathParameters: { specifyDate?: string };
}): Promise<{ statusCode: number; body: string }> => {
  const { specifyDate } = event.pathParameters ?? {};
  if (specifyDate === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ "status": "Bed Request" }),
    };
  }
  const date = new Date(specifyDate);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const data = await client.send(new QueryCommand({
    TableName: process.env.BRIGHTLY_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: formattedDate }
    }
  }));
  if (data === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ "status": "Bed Request" }),
    };
  }

  const attributeKeys = ["data", "place", "qsLight", "qsPIR"];
  const Item = data.Items?.map(item => {
    return Object.fromEntries(
      attributeKeys.map(key => [key, unmarshall(item)[key]])
    );
  });
  if (Item === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ "status": "Bed Request" }),
    };
  }
  const output = Item[0];
  delete output.qsLight;
  delete output.qsPIR;

  return {
    statusCode: 200,
    body: JSON.stringify(output),
  };
};