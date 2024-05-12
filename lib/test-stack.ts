import * as cdk from 'aws-cdk-lib';
import path from 'path';
import { Construct } from 'constructs';
import dotenv from 'dotenv';
import { Cors } from 'aws-cdk-lib/aws-apigateway';
dotenv.config();

export class brightlyLitBangkok extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------  DynamoDB  ------    
    const brightlyTable = new cdk.aws_dynamodb.Table(this, 'brightlyTable', {
      partitionKey: {
        name: 'PK', // date
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const globalValeTable = new cdk.aws_dynamodb.Table(this, 'globalValeTable', {
      partitionKey: {
        name: 'PK', 
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ------  Lambda Functions  ------
    const getBrightly = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getBrightly', {
      entry: path.join(__dirname, 'brightly/getBrightly', 'handler.ts'),
      handler: 'handler',
      environment: {
        BRIGHTLY_TABLE_NAME: brightlyTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    brightlyTable.grantReadData(getBrightly);

    const createBrightly = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'createBrightly', {
      entry: path.join(__dirname, 'brightly/createBrightly', 'handler.ts'),
      handler: 'handler',
      environment: {
        BRIGHTLY_TABLE_NAME: brightlyTable.tableName,
        GLOBAL_TABLE_NAME: globalValeTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    brightlyTable.grantReadWriteData(createBrightly);
    globalValeTable.grantReadWriteData(createBrightly);

    const getCurrentStatus = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getCurrentStatus', {
      entry: path.join(__dirname, 'brightly/getCurrentStatus', 'handler.ts'),
      handler: 'handler',
      environment: {
        BRIGHTLY_TABLE_NAME: brightlyTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    brightlyTable.grantReadData(getCurrentStatus);

    const getSpecifyStatus = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getSpecifyStatus', {
      entry: path.join(__dirname, 'brightly/getSpecifyStatus', 'handler.ts'),
      handler: 'handler',
      environment: {
        BRIGHTLY_TABLE_NAME: brightlyTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    brightlyTable.grantReadData(getSpecifyStatus);

    const alert = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'alert', {
      entry: path.join(__dirname, 'brightly/alert', 'handler.ts'),
      handler: 'handler',
      environment: {
        BRIGHTLY_TABLE_NAME: brightlyTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    brightlyTable.grantReadData(alert);

    // ------  API Gatway  ------
    // Create a new API
    const brightlyLitBangkokAPI = new cdk.aws_apigateway.RestApi(this, 'brightlyLitBangkokAPI', {
      restApiName: "brightlyLitBangkokAPI",
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
    });

    // Add routes to the API
    const brightlyResource = brightlyLitBangkokAPI.root.addResource('brightly');
    brightlyResource.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getBrightly));
    brightlyResource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(createBrightly));

    brightlyLitBangkokAPI.root.addResource('getCurrentStatus').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getCurrentStatus));
    brightlyLitBangkokAPI.root.addResource('getSpecifyStatus').addResource('{specifyDate}').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getSpecifyStatus));
    brightlyLitBangkokAPI.root.addResource('alert').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(alert));
  }
}