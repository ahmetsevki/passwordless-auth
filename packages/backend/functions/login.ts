import * as crypto from 'crypto'
import * as AWS from 'aws-sdk'
import { APIGatewayProxyHandler } from 'aws-lambda'
import { CognitoIdentityServiceProvider, SES } from 'aws-sdk'
import * as _ from 'lodash';

const cisp = new CognitoIdentityServiceProvider()
const ses = new SES({ region: process.env.AWS_REGION })
const ddb = new AWS.DynamoDB.DocumentClient({  region: process.env.AWS_REGION })

// TODO: increase num bytes - short for decoding
const NumBytesForRandomStr = 10
const putAuthChallenge = async ({email, emailSecret, browserToken, browserRandom}: {email: string, emailSecret: string, browserToken: string, browserRandom: string}) => {
  const linkTimeout = parseInt(process.env.LINK_TIMEOUT_SECONDS || '60', 10)
  const ttl = Math.round(Date.now() / 1000) + linkTimeout;

  // the ttl is only so that our session tokens do not pollute the table
  // even if we did not ttl this and the front end gets the special code,
  // the link timeout ensures the user cannot get a token with this expired link token!
  await ddb
    .put({
        TableName: process.env.AUTH_CHALLENGE_TABLE!,
        Item: {email, emailSecret, browserToken, ttl, browserRandom},
    })
    .promise()
}
export const handler: APIGatewayProxyHandler = async(event) => {
  console.log(JSON.stringify(event))
  try {
      const { email } = JSON.parse(event.body || '{}');
      // TODO: signup using Amplify
      await adminSignup(email)
      const browserToken = crypto.randomBytes(NumBytesForRandomStr).toString('hex');
      // Store challenge as a custom attribute in Cognito
      const emailSecret = crypto.randomBytes(NumBytesForRandomStr).toString('hex');
      const browserRandom = `${_.random(10,100)}`;

      await putAuthChallenge({email, browserToken, emailSecret, browserRandom})
      await sendEmail({emailAddress:email, emailSecret, browserToken, browserRandom});
      return {
          statusCode: 200,
          headers: {
              'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
              // browser will get this browserToken, and will keep querying to get back the emailSecret
              // secret. Once the email link is clicked, browserToken => emailSecret will be there
              // for the browser to get back it and login with it.
              browserToken,
              // the page which user tried to login from will show this "browserRandom"
              // against potential attacks! so user will not click on email triggered by an attacker
              browserRandom
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

async function adminSignup(email: string){
  try{
      await cisp.adminGetUser({
          UserPoolId: process.env.USER_POOL_ID!,
          Username: email,
      }).promise();
    }catch(e){
        console.log(`adminGetUser fail`, JSON.stringify(e))
        if (e.code !== 'UserNotFoundException'){
            throw e;
        }
        console.log(`User ${email} not found, creating.`)
        await cisp.adminCreateUser({
            UserPoolId: process.env.USER_POOL_ID!,
            Username: email,
            MessageAction: "SUPPRESS", // do not send email
            UserAttributes: [{
                Name: 'email',
                Value: email
            },
            {
                Name: 'email_verified',
                Value: 'true'
            },
            ]
        }).promise()
    }
}
// this is the route in react
const BASE_URL = `http://localhost:3000`
async function sendEmail(params: { emailAddress: string;emailSecret: string; browserToken: string; browserRandom: string}) {
  const { emailAddress, emailSecret, browserToken, browserRandom} = params;
  const url = `${BASE_URL}/verify/${emailAddress},${emailSecret},${browserToken}`
  // invalidateUrl: send browserToken to invalidate the current auth
  const invalidateUrl = `${BASE_URL}/verify/${emailAddress},invalidate,${browserToken}`
  const others = _.shuffle(_.range(10,100).filter( x => x !== parseInt(browserRandom, 10)))
  const options = _.shuffle([
      { browserRandom, url},
      { browserRandom: others[0], url: invalidateUrl},
      { browserRandom: others[1], url: invalidateUrl}])
  const emailParams = {
      Destination: { ToAddresses: [emailAddress] },
      Message: {
          Body: {
              Html: {
                  Charset: 'UTF-8',
                  Data: `<html><body>
                         <h3>We are making sure that it is you, click on the number you see on your login screen?</h3>
                         <p><a href=${options[0].url} target="_blank">${options[0].browserRandom}</a></p>
                         <p><a href=${options[1].url} target="_blank">${options[1].browserRandom}</a></p>
                         <p><a href=${options[2].url} target="_blank">${options[2].browserRandom}</a></p>
                         <p><a href=${invalidateUrl} target="_blank"><b> I do not see my number!</b></a></p>
                         </body></html>`
              },
              Text: {
                  Charset: 'UTF-8',
                  Data: `Your secret login code: ${emailSecret}: ${url}`
              }
          },
          Subject: {
              Charset: 'UTF-8',
              Data: 'Your secret login code'
          }
      },
      Source: process.env.SES_FROM_ADDRESS,
  };
  await ses.sendEmail(emailParams).promise();
}

