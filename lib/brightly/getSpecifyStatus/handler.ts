import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

export const handler = async (event : {
  pathParameters: { specifyDate?: string };
}) => {
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
  const Items = data.Items?.map(item => {
    return Object.fromEntries(
      attributeKeys.map(key => [key, unmarshall(item)[key]])
    );
  });
  if (Items === undefined) {
    return {
      statusCode: 400,
      body: JSON.stringify({ "status": "Bed Request" }),
    };
  }
  const Item = Items[0];
  delete Item.qsLight;
  delete Item.qsPIR;

  const value = Item.data;
  var output: unknown[] = [];
  let m = Math.floor(value.length / 7);
  if(m < 1) m = 1;
  let sumLight = 0, sumPir = 0;
  for(let i=0, j=0;i<value.length;i++,j++) {
    if(j == m || i == value.length-1) {
      output.push({
        light: parseFloat((sumLight / j).toFixed(2)),
        pir: parseFloat((sumPir / j * 100).toFixed(2)),
        timestamp: value[i].timestamp
      })
      sumLight = sumPir = j = 0;
    } 
    sumLight += value[i].light;
    sumPir += value[i].pir;
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(output),
  };
};