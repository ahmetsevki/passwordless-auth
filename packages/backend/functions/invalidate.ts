import * as AWS from 'aws-sdk'

const ddb = new AWS.DynamoDB.DocumentClient({
    region: 'us-east-1',
  });

export const invalidateAuthChallenge = ({browserToken, email}: {browserToken: string, email: string}) =>
    Promise.all( [
        ddb.delete({
            TableName: process.env.SESSION_TABLE!,
            Key: { browserToken},
            ConditionExpression: "email = :val",
            ExpressionAttributeValues: {
                ":val": email
            }
        })
        .promise(),
        ddb.delete({
            TableName: process.env.AUTH_CHALLENGE_TABLE!,
            Key: { browserToken},
            ConditionExpression: "email = :val",
            ExpressionAttributeValues: {
                ":val": email
            }
        })
        .promise(),
    ]);


export const handler = async(event: any) => {
    console.log(JSON.stringify(event))
    const { email, browserToken } = JSON.parse(event.body || '{}');
    try {
        await invalidateAuthChallenge({email, browserToken})
    }catch(e){
        console.log(`failed invalidate`, e)
    }
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({})
    };
}