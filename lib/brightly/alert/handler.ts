import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

export const handler = async () => {
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
  if (currentStatus === undefined || currentStatus.pir.N === undefined || currentStatus.light.N === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }

  const timestampBefore = currentStatus.timestamp.N?.toString() - 1 * 60 * 1000;
  let sumPir = 0;
  for(let i=data.length - 1; i >= 0; i--) {
    if(parseInt(data[i].M.timestamp.N.toString()) <= timestampBefore || i == 0) {
      sumPir = sumPir / (data.length - i) * 100;
      break;
    }
    sumPir += parseInt(data[i].M.pir.N?.toString());
  }

  let alertPIR = false, alertLight = false;
  if(sumPir > 15 || sumPir < 0) alertPIR = true;
  if(parseInt(currentStatus.light.N) > 15 || parseInt(currentStatus.light.N) < 0) alertLight = true;

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ 
        alertPir: alertPIR, 
        alertLight: alertLight,
        timestamp: parseInt(currentStatus.timestamp.N.toString())
    }),
  };
};