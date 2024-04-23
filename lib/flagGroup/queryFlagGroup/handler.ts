import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import assert from "node:assert";
import { getEncoding } from "js-tiktoken";
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

export const handler = async (event: {
  body: string;
}): Promise<{ statusCode: number; body: string }> => {
  const message = event.body;

  if (message === undefined) {
    return {
      statusCode: 400,
      body: 'You must pass a message',  
    };
  }

  // GPT encoding using js-tiktoken
  const enc = getEncoding("cl100k_base");
  assert(enc.decode(enc.encode("token test")) === "token test");
  
  // Input cost
  const tokens = enc.encode(message);
  let tokenCount = 0;

  tokens.forEach(x => {
    tokenCount += x;
  });

  // Output cost
  const params = {
    TableName: process.env.FLAG_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: "flagGroups" }
    }
  };

  const data = await client.send(new QueryCommand(params));
  if(data === undefined) {
    return {
      statusCode: 404,
      body: 'not found data',
    };
  }

  const attributeKeys = ["name", "flags"];

  const allItems = data.Items?.map(item => {
    return Object.fromEntries(
      attributeKeys.map(key => [key, unmarshall(item)[key]])
    );
  });

  if(allItems === undefined) {
    return {
      statusCode: 404,
      body: 'not found items',
    };
  }

  for(let i = 0; i < allItems.length; i++) {
    const tokens = enc.encode(JSON.stringify(allItems[i]));
    let itemTokenCount = 0;
    tokens.forEach(y => {
      itemTokenCount += y;
    })

    // gpt-3.5-turbo-0125 : cost-effective
    const totalGroupCost = (tokenCount + itemTokenCount) * 0.5 / 1e6;

    const copy = Object.assign(allItems[i], {"cost": totalGroupCost});
    allItems[i] = copy;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      "flags_group": allItems
    }),
  };
};