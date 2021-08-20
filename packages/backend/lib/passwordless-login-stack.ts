import * as cdk from '@aws-cdk/core'
import * as cg from '@aws-cdk/aws-cognito'
import * as iam from '@aws-cdk/aws-iam'
import * as apiGw from '@aws-cdk/aws-apigateway'
import * as dynamodb from '@aws-cdk/aws-dynamodb'

import { lambda } from './helpers'

export class PasswordlessLoginStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)
    // when we send an email, we end up creating an entry here for email link
    // "login" puts a secret here, "createAuthChallenge" reads it to create cognito challenge
    const authChallengeTable = new dynamodb.Table(this, 'authChallenge', {
      partitionKey: { name: 'browserToken', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl'
    })

    // when a user clicks on the link on email, it creates an authenticated session
    // "verifyAuthChallengeResponse" puts an item here once user clicks on session
    // "token" reads it (browser keeps querying the session table until user clicks on email)
    // note: this ttl is not for tokens, once the front end finds a session on this table
    // it uses Amplify to authenticate and get JWT tokens, and it will use refresh token from then on
    // to refresh session.
    const sessionTable = new dynamodb.Table(this, 'session', {
      partitionKey: { name: 'browserToken', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl'
    })

    const emailLinkTimeoutSeconds = 300
    const postAuthentication = lambda(this, 'postAuthentication')
    const createAuthChallenge = lambda(this, 'createAuthChallenge')
      .addEnvironment('AUTH_CHALLENGE_TABLE', authChallengeTable.tableName);
    const verifyAuthChallengeResponse = lambda(this, 'verifyAuthChallenge')
      .addEnvironment('LINK_TIMEOUT_SECONDS', `${emailLinkTimeoutSeconds}`)
      .addEnvironment('SESSION_TABLE', sessionTable.tableName)

    // User Pool and client
    const userPool = new cg.UserPool(this, 'users', {
      standardAttributes: { email: { required: true, mutable: true } },
      customAttributes: {
        authChallenge: new cg.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cg.AccountRecovery.NONE,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      lambdaTriggers: {
        preSignUp: lambda(this, 'preSignup'),
        createAuthChallenge,
        defineAuthChallenge: lambda(this, 'defineAuthChallenge'),
        verifyAuthChallengeResponse,
        postAuthentication,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // we cannot use addToRolePolicy, instead we need to do this
    // otherwise we will get a circular dependency (this lambda is passed to cognito as a hook)
    postAuthentication.role?.attachInlinePolicy(
      new iam.Policy(this, 'allowConfirmingUser', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cognito-idp:AdminUpdateUserAttributes'],
            resources: [userPool.userPoolArn],
          }),
        ],
      })
    )

    createAuthChallenge.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [authChallengeTable.tableArn],
      }),
    )
    verifyAuthChallengeResponse.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [sessionTable.tableArn],
      }),
    )
    const webClient = userPool.addClient('webAppClient', {
      authFlows: { custom: true },
    })

    const api = new apiGw.RestApi(this, 'authApi', {
      endpointConfiguration: { types: [apiGw.EndpointType.REGIONAL] },
      defaultCorsPreflightOptions: { allowOrigins: ['*'] },
      deployOptions: { stageName: 'dev' },
    })

    const signIn = lambda(this, 'signIn')
      .addEnvironment('SES_FROM_ADDRESS', process.env.SES_FROM_ADDRESS)
      .addEnvironment('USER_POOL_ID', userPool.userPoolId)

    signIn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail'],
        resources: ['*'],
      })
    )
    signIn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminUpdateUserAttributes'],
        resources: [userPool.userPoolArn],
      })
    )

    const signInMethod = new apiGw.LambdaIntegration(signIn)
    api.root.addMethod('POST', signInMethod)



    const login = lambda(this, 'login')
      .addEnvironment('SES_FROM_ADDRESS', process.env.SES_FROM_ADDRESS)
      .addEnvironment('USER_POOL_ID', userPool.userPoolId)
      .addEnvironment('LINK_TIMEOUT_SECONDS', `${emailLinkTimeoutSeconds}`)
      .addEnvironment('AUTH_CHALLENGE_TABLE', authChallengeTable.tableName)
    login.addToRolePolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminCreateUser'],
            resources: [userPool.userPoolArn],
          }),
      )
    login.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ses:SendEmail'],
          resources: ['*'],
        })
      )
    login.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [authChallengeTable.tableArn],
      }),
    )
    const loginMethod = new apiGw.LambdaIntegration(login)
    api.root.addResource('login').addMethod('POST', loginMethod)

    const token = lambda(this, 'token')
      .addEnvironment('SESSION_TABLE', sessionTable.tableName)
    token.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [sessionTable.tableArn],
      }),
    )
    const tokenMethod = new apiGw.LambdaIntegration(token)
    api.root.addResource('token').addMethod('POST', tokenMethod)


    const invalidate = lambda(this, 'invalidate')
      .addEnvironment('SESSION_TABLE', sessionTable.tableName)
      .addEnvironment('AUTH_CHALLENGE_TABLE', authChallengeTable.tableName)
    invalidate.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:DeleteItem'],
        resources: [sessionTable.tableArn, authChallengeTable.tableArn],
      }),
    )
    const invalidateMethod = new apiGw.LambdaIntegration(invalidate)
    api.root.addResource('invalidate').addMethod('POST', invalidateMethod)


    new cdk.CfnOutput(this, 'userPoolId', {
      value: userPool.userPoolId,
    })

    new cdk.CfnOutput(this, 'clientId', {
      value: webClient.userPoolClientId,
    })
  }
}
