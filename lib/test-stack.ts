import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import path from 'path';

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
    

    // ------  Lambda Functions  ------
    const listGroup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'listGroup', {
      entry: path.join(__dirname, 'listGroup', 'handler.ts'),
      handler: 'handler',
      environment: {
        FLAG_TABLE_NAME: flagsTable.tableName
      },
    });
    flagsTable.grantReadData(listGroup); // VERY IMPORTANT

    const secretLambda = new lambda.Function(this, 'secretPy', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'handler.handler', // Assumes your handler function is named 'handler' in a file named handler.py
      code: lambda.Code.fromAsset(path.join(__dirname, 'secretPy')),
      environment: {
        USER_TABLE_NAME: usersTable.tableName
      },
    });
    usersTable.grantReadData(secretLambda); // VERY IMPORTANT

    // Provision a signup lambda function
    const signup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signup', {
      entry: path.join(__dirname, 'signup', 'handler.ts'),
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
      entry: path.join(__dirname, 'confirm', 'handler.ts'),
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
      entry: path.join(__dirname, 'signin', 'handler.ts'),
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

    DmeenApi.root.addResource('listGroup').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(listGroup));
    // Create a new secret route, triggering the secret Lambda, and protected by the authorizer
    DmeenApi.root.addResource('secret').addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(secretLambda), {
      authorizer,
      authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
    });
  }
}