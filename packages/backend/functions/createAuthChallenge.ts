import { CreateAuthChallengeTriggerHandler } from 'aws-lambda'
import * as AWS from 'aws-sdk'

const getAuthChallenge = async (browserToken: string) => {
  const ddb = new AWS.DynamoDB.DocumentClient({
      region: 'us-east-1',
    });
  return ddb
  .get({
    Key: {
      browserToken,
    },
    TableName: process.env.AUTH_CHALLENGE_TABLE!,
  })
  .promise()
  .then( r => r.Item as undefined | { email: string; emailSecret: string; browserToken: string; ttl: number})
}

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  console.log(`event:`, JSON.stringify(event))
  const {email} = event.request.userAttributes
  if (!event.request.session || event.request.session.length === 0){
    event.response.publicChallengeParameters = {
      email
    };
    event.response.privateChallengeParameters = {challenge: '' };
    event.response.challengeMetadata='SEND_BROWSER_TOKEN';
    console.log(`response:`, JSON.stringify(event.response))
    return event;
  }
  if (event.request.clientMetadata?.browserToken){
    const challenge = await getAuthChallenge(event.request.clientMetadata.browserToken)
    if (!challenge || challenge.email !== email){
        console.log(`cannot get challenge for ${email}`)
        throw Error(`challenge`)
    }
    // This is sent back to the client app
    event.response.publicChallengeParameters = {
        email
    };
    const { emailSecret, browserToken, ttl} = challenge;
    // Add the secret login code to the private challenge parameters
    // so it can be verified by the "Verify Auth Challenge Response" trigger
    event.response.privateChallengeParameters = {
        challenge: `${emailSecret},${browserToken},${ttl}`
    };
    event.response.challengeMetadata='SEND_CODE';
    console.log(`response:`, JSON.stringify(event.response))
    return event;
  }
  throw Error(`browser token not found`)
}
