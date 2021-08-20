import * as AWS from 'aws-sdk'
import * as _ from 'lodash';

const ddb = new AWS.DynamoDB.DocumentClient({  region: process.env.AWS_REGION })

const getSessionWithBrowserToken = async (browserToken: string) =>
    ddb
    .get({
      Key: {
        browserToken,
      },
      TableName: process.env.SESSION_TABLE!,
    })
    .promise()

export const handler = async(event: any) => {

    try {
        console.log(JSON.stringify(event, null, 2))
        const { browserToken, email } = JSON.parse(event.body);
        const autenticated = await getSessionWithBrowserToken(browserToken);
        console.log(`dynamodb authenticated item:`, JSON.stringify(autenticated))
        let emailSecret: any;
        if(autenticated.Item?.email === email){
            // minting emailSecret on server side
            // const user = await cognito.adminGetUser({
            //     UserPoolId: process.env.USER_POOL_ID!,
            //     Username: email
            // }).promise();
            // const authChallenge = user.UserAttributes?.find( r => r.Name === 'custom:authChallenge')?.Value
            // const [challengeAnwer] = (authChallenge || '').split(',');
            // console.log(`authChallenge:`, authChallenge)
            // const session = await cognito.adminInitiateAuth({
            //     UserPoolId: process.env.USER_POOL_ID!,
            //     ClientId: process.env.USER_POOL_CLIENT_ID!,
            //     AuthFlow: 'CUSTOM_AUTH',
            //     AuthParameters: {USERNAME: email}
            //     }).promise()
            // console.log(`session: `, JSON.stringify(session, null, 2))
            // emailSecret = await cognito.respondToAuthChallenge({
            //     ClientId: process.env.USER_POOL_CLIENT_ID!,
            //     ChallengeName: 'CUSTOM_CHALLENGE',
            //     Session: session.Session!,
            //     ChallengeResponses: { USERNAME: email, ANSWER: challengeAnwer}
            // }).promise()
            emailSecret = autenticated.Item?.emailSecret;
        }
        console.log(`returning emailSecret:`, JSON.stringify(emailSecret, null, 2))
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                emailSecret // browser will use this like the email client to log in!
            })
        };
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Sorry, we could not find your account.',
                errorDetail: e.message
            })
        };
    }
};

