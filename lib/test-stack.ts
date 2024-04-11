import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import path from 'path';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DmeenApp extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------  Cognito  ------
    const userPool = new cdk.aws_cognito.UserPool(this, 'DmeenUserPool', {
      selfSignUpEnabled: true,
      autoVerify: {
        email: true,
      },
    });

    const userPoolClient = new cdk.aws_cognito.UserPoolClient(this, 'DmeenUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
      },
    });

    // ------  DynamoDB  ------
    const usersTable = new cdk.aws_dynamodb.Table(this, 'User', {
      partitionKey: {
        name: 'PK', // userId
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK', // username
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });   

    const flagsTable = new cdk.aws_dynamodb.Table(this, 'Flag', {
      partitionKey: {
        name: 'PK', // flagId
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK', // group_name
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });  
    
    const promptTable = new cdk.aws_dynamodb.Table(this, 'Prompt', {
      partitionKey: {
        name: 'PK', // version
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });  

    const postRecordTable = new cdk.aws_dynamodb.Table(this, 'PostRecord', {
      partitionKey: {
        name: 'PK', // postId
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    }); 

    // ------  Lambda Functions  ------
    const listGroups = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'listGroups', {
      entry: path.join(__dirname, 'listGroups', 'handler.ts'),
      handler: 'handler',
      environment: {
        FLAG_TABLE_NAME: flagsTable.tableName
      },
    });
    flagsTable.grantReadData(listGroups); // VERY IMPORTANT

    const extract = new lambda.Function(this, 'extract', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler', // Assumes your handler function is named 'handler' in a file named handler.py
      code: lambda.Code.fromAsset(path.join(__dirname, 'extract')),
      environment: {
        AZURE_OPENAI_ENDPOINT: "https://aimet-dev.openai.azure.com/",
        AZURE_OPENAI_KEY: "4084fe60da564e6d8e199a18bad4f836",
        PROMPT_TABLE_NAME: promptTable.tableName,
        RECORD_TABLE_NAME: postRecordTable.tableName,
        USER_TABLE_NAME: usersTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
    });
    usersTable.grantReadWriteData(extract); 
    promptTable.grantReadData(extract);
    postRecordTable.grantWriteData(extract);
    extract.addLayers(
      lambda.LayerVersion.fromLayerVersionArn(this, 'python-lib', 'arn:aws:lambda:ap-southeast-1:143492957817:layer:python-lib:1')
    )

    // Provision a signup lambda function
    const signup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signup', {
      entry: path.join(__dirname, 'auth/signup', 'handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
    
    // Give the lambda function the permission to sign up users
    signup.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:SignUp'],
        resources: [userPool.userPoolArn],
      }),
    );
    
    // Provision a confirm lambda function
    const confirm = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'confirm', {
      entry: path.join(__dirname, 'auth/confirm', 'handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USER_TABLE_NAME: usersTable.tableName
      },
    });
    
    // Give the lambda function the permission to confirm users
    confirm.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:ConfirmSignUp'],
        resources: [userPool.userPoolArn],
      }),
    );
    usersTable.grantWriteData(confirm); // VERY IMPORTANT

    // Provision a signin lambda function
    const signin = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signin', {
      entry: path.join(__dirname, 'auth/signin', 'handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    // Give the lambda function the permission to sign in users
    signin.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:InitiateAuth'],
        resources: [userPool.userPoolArn],
      }),
    );

    // ------  API Gatway  ------
    // Create a new API
    const DmeenApi = new cdk.aws_apigateway.RestApi(this, 'DmeenApi', {});

    // Create an authorizer based on the user pool
    const authorizer = new cdk.aws_apigateway.CognitoUserPoolsAuthorizer(this, 'DmeenAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // Add routes to the API
    // Authentications
    const authResource = DmeenApi.root.addResource('auth')
    authResource.addResource('sign-up').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(signup));
    authResource.addResource('sign-in').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(signin));
    authResource.addResource('confirm').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(confirm));

    DmeenApi.root.addResource('listGroups').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(listGroups));
    // Create a new secret route, triggering the secret Lambda, and protected by the authorizer
    DmeenApi.root.addResource('extract').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(extract), {
      authorizer,
      authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
    });
  }
}