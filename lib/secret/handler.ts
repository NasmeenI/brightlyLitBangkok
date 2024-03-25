import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, GetObjectCommandOutput, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { jwtDecode } from "jwt-decode";
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const s3Client = new S3Client({});

export const handler = async (event: any) => {
  const token = event.headers.Authorization.split(' ')[1];
  const decoded = jwtDecode(token);
  const sub = decoded['sub']
  const username = decoded['cognito:username'];

  const User = await client.send(
    new GetItemCommand({
      TableName: process.env.USER_TABLE_NAME,
      Key: {
        PK: { S: sub },
        SK: { S: username },
      },
    }),
  );

  // const id = uuidv4();
  // await s3Client.send(
  //   new PutObjectCommand({
  //     Bucket: process.env.BUCKET_NAME,
  //     Key: id,
  //     Body: "test",
  //   }),
  // );
  let result: GetObjectCommandOutput | undefined;
  try {
    result = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: "aimet_feature_extraction.py",
      }),
    );
  } catch {
    result = undefined;
  }
  if (result?.Body === undefined) {
    return { statusCode: 404, body: 'Article not found' };
  }
  const content = await result.Body.transformToString();

  return {
      statusCode: 200,
      body: JSON.stringify(content),
  };
};