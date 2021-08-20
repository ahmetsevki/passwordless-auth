import { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda'

import * as AWS from 'aws-sdk'

const insertSession = async (params: {browserToken: string, email: string, emailSecret: string}) => {
    const linkTimeout = parseInt(process.env.LINK_TIMEOUT_SECONDS || '60', 10)
    const ttl = Math.round(Date.now() / 1000) + linkTimeout;
    const ddb = new AWS.DynamoDB.DocumentClient({
        region: 'us-east-1',
      });
    // the ttl is only so that our session tokens do not pollute the table
    // even if we did not ttl this and the front end gets the special code,
    // the link timeout ensures the user cannot get a token with this expired link token!
    await ddb
    .put({
      TableName: process.env.SESSION_TABLE!,
      Item: {...params, ttl},
    })
    .promise()
}

export const handler: VerifyAuthChallengeResponseTriggerHandler = async(event) => {
    console.log(JSON.stringify(event))
    if (event.request.privateChallengeParameters.challenge === ''){
        // special case, first challenge, we don't care about this.
        event.response.answerCorrect = true;
        console.log(`this is first challenge, returning true!`)
        return event;
    }
    // Get challenge and timestamp from user attributes
    const [emailSecret, browserToken, ttl] = (event.request.privateChallengeParameters.challenge || '').split(',');

    // 1. Check if code is equal to what we expect...
    if (event.request.challengeAnswer === emailSecret) {
        // 2. And whether the link hasn't timed out...
        if (Number(ttl)  > (new Date()).valueOf() / 1000 ) {
            console.log(`ttl: ${new Date(Number(ttl) * 1000)}, now: ${new Date()}`)
            event.response.answerCorrect = true;
            console.log(`successful verify, inserting into dynamodb`)
            // insert into dynamodb, TODO: this could be in postauthentication lambda hook
            await insertSession({ browserToken, email: event.request.userAttributes.email, emailSecret})
            return event;
        }
        console.log(`link expired - ttl: ${new Date(Number(ttl) * 1000)}, now: ${new Date()}`)
        event.response.answerCorrect = false;
        return event;
    }

    // Fallback
    event.response.answerCorrect = false;
    return event;

};


const MAGIC_LINK_TIMEOUT = 3 * 60 * 1000

export const handler_old: VerifyAuthChallengeResponseTriggerHandler = async (
  event
) => {
  const [authChallenge, timestamp] = (
    event.request.privateChallengeParameters.challenge || ''
  ).split(',')

  // fail if any one of the parameters is missing
  if (!authChallenge || !timestamp) {
    event.response.answerCorrect = false
    return event
  }

  // is the correct challenge and is not expired
  if (
    event.request.challengeAnswer === authChallenge &&
    Date.now() <= Number(timestamp) + MAGIC_LINK_TIMEOUT
  ) {
    event.response.answerCorrect = true
    return event
  }

  event.response.answerCorrect = false
  return event
}
