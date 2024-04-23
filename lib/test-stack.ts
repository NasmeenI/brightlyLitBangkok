import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import path from 'path';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import dotenv from 'dotenv';
dotenv.config();

export class DmeenApp extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'DMEEN-vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 1,
      maxAzs: 3,
    });

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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
    const getFlagGroup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'getFlagGroup', {
      entry: path.join(__dirname, 'flagGroup/getFlagGroup', 'handler.ts'),
      handler: 'handler',
      environment: {
        FLAG_TABLE_NAME: flagsTable.tableName, // VERY IMPORTANT
      },
      timeout: cdk.Duration.seconds(15),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    flagsTable.grantReadData(getFlagGroup);

    const createFlagGroup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'createFlagGroup', {
      entry: path.join(__dirname, 'flagGroup/createFlagGroup', 'handler.ts'),
      handler: 'handler',
      environment: {
        FLAG_TABLE_NAME: flagsTable.tableName, // VERY IMPORTANT
      },
      timeout: cdk.Duration.seconds(15),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    flagsTable.grantWriteData(createFlagGroup);

    const queryFlagGroup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'queryFlagGroup', {
      entry: path.join(__dirname, 'flagGroup/queryFlagGroup', 'handler.ts'),
      handler: 'handler',
      environment: {
        FLAG_TABLE_NAME: flagsTable.tableName, // VERY IMPORTANT
      },
      timeout: cdk.Duration.seconds(15),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    flagsTable.grantReadData(queryFlagGroup);
    
    const extract = new lambda.Function(this, 'extract', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'extract')),
      environment: {
        AZURE_OPENAI_ENDPOINT: String(process.env.AZURE_OPENAI_ENDPOINT),
        AZURE_OPENAI_KEY: String(process.env.AZURE_OPENAI_KEY),
        PROMPT_TABLE_NAME: promptTable.tableName,
        RECORD_TABLE_NAME: postRecordTable.tableName,
        USER_TABLE_NAME: usersTable.tableName,
      },
      timeout: cdk.Duration.seconds(15),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    usersTable.grantReadWriteData(extract); 
    promptTable.grantReadData(extract);
    postRecordTable.grantWriteData(extract);
    extract.addLayers(
      lambda.LayerVersion.fromLayerVersionArn(this, String(process.env.LAMBDA_LAYER_NAME), String(process.env.LAMBDA_LAYER_ARN))
    )

    // Provision a signup lambda function
    const signup = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'signup', {
      entry: path.join(__dirname, 'auth/signup', 'handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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
    // FlagGroups
    const flagGroupResource = DmeenApi.root.addResource('flagGroup');
    flagGroupResource.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getFlagGroup));
    flagGroupResource.addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(createFlagGroup));
    DmeenApi.root.addResource('queryFlagGroup').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(queryFlagGroup));
    // Create a new secret route, triggering the secret Lambda, and protected by the authorizer
    DmeenApi.root.addResource('extract').addMethod('POST', new cdk.aws_apigateway.LambdaIntegration(extract), {
      authorizer,
      authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
    });
  }
}