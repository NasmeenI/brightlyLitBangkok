import { 
  DynamoDBClient, 
  GetItemCommand, 
  PutItemCommand,
  UpdateItemCommand
} from '@aws-sdk/client-dynamodb';

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

  const { Item } = await client.send(new GetItemCommand({
    TableName: process.env.GLOBAL_TABLE_NAME,
    Key: {
      PK: { S: "current_date" },
    },
  }));
  if (Item === undefined) {
    return {
      statusCode: 404,
      body: 'not found',
    };
  }
  
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long' as const,
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
    timeZone: 'Asia/Bangkok'
  };
  const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);

  const timestampUTC = Date.now();
  const timezoneOffset = 7 * 60 * 60 * 1000;
  const timestampBangkok = timestampUTC + timezoneOffset;

  if(Item.current_date.S === formattedDate) {
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
    const currentQsLight = getItemResponse.Item.qsLight.L;
    const lastQsLight = currentQsLight[currentQsLight.length - 1].N;

    if (lastQsLight === undefined) {
      return {
        statusCode: 404,
        body: 'not found',
      };
    }
    const newQsLightValue = parseInt(lastQsLight) + body.light;

    if (getItemResponse.Item.qsPIR.L === undefined) {
      return {
        statusCode: 404,
        body: 'not found',
      };
    }
    const currentQsPIR = getItemResponse.Item.qsPIR.L;
    const lastQsPIR = currentQsPIR[currentQsPIR.length - 1].N;

    if (lastQsPIR === undefined) {
      return {
        statusCode: 404,
        body: 'not found',
      };
    }
    const newQsPIRValue = parseInt(lastQsPIR) + body.pir;

    const newItem = await client.send(new UpdateItemCommand({
      TableName: process.env.BRIGHTLY_TABLE_NAME,
      Key: {
        PK: { S: formattedDate },
      },
      UpdateExpression: 'SET #data = list_append(#data, :newData), #qsLight = list_append(#qsLight, :newQsLight), #qsPIR = list_append(#qsPIR, :newQsPIR)',
      ExpressionAttributeNames: {
        '#data': 'data',
        '#qsLight': 'qsLight',
        '#qsPIR': 'qsPIR',
      },
      ExpressionAttributeValues: {
        ':newData': {
          L: [
            {
              M: {
                light: { N: body.light.toString() },
                pir: { N: body.pir.toString() },
                timestamp: { N: timestampBangkok.toString() },
              }
            }
          ]
        },
        ':newQsLight': {
          L: [
            { N: newQsLightValue.toString() }
          ]
        },
        ':newQsPIR': {
          L: [
            { N: newQsPIRValue.toString() } 
          ]
        },
      },
    }))
  }
  else {
    await client.send(new UpdateItemCommand({
      TableName: process.env.GLOBAL_TABLE_NAME,
      Key: {
        'PK': { S: 'current_date' },
      },
      UpdateExpression: 'SET current_date = :val',
      ExpressionAttributeValues: {
        ':val': { S: formattedDate },
      },
    }));

    const newItem = await client.send(
      new PutItemCommand({
        TableName: process.env.BRIGHTLY_TABLE_NAME,
        Item: {
          PK: { S: formattedDate },
          place: { S: body.place },
          data: {
            L: [
              {
                M: {
                  light: { N: body.light.toString() },
                  pir: { N: body.pir.toString() },
                  timestamp: { N: timestampBangkok.toString() }
                }
              }
            ]
          },
          qsLight: {
            L: [
              { N: body.light.toString() }
            ]
          },
          qsPIR: {
            L: [
              { N: body.pir.toString() }
            ]
          }
        },
      }),
    );
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ result: "success" }),
  };
};