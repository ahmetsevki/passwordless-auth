import axios from 'axios'
import config from '../cdk-exports.json'
import { Auth } from 'aws-amplify'

const tokenUrl = `${config.PasswordlessLoginStack.authApiEndpointF052B0B5}token`
const loginUrl = `${config.PasswordlessLoginStack.authApiEndpointF052B0B5}login`
const invalidateUrl = `${config.PasswordlessLoginStack.authApiEndpointF052B0B5}invalidate`

export const requestMagicLink = async (email: string) => {
  const res = await axios.post(
    loginUrl,
    { email }
  )
  return res.data
}

export const fetchEmailSecretWithBrowserSecret = async (params: { email: string, browserToken: string}) => {
  const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  console.log(`fetchEmailSecretWithBrowserSecret: params: `, params)
  while(true){
      console.log(`sleeping`)
      await sleep(3000);
      const { email, browserToken } = params;
      // this gets the email secret by sending out the browserToken
      // and getting back the secret
      // (possible only after the email is clicked and cognito lambdas insert the secret to dynamo)
      const {data} = await axios.post(tokenUrl, {email, browserToken})
      if (data.emailSecret){
        console.log(`result of post`, data)
        return data.emailSecret;
      }
  }
}

export const invalidateAuth = async ({email, browserToken}: { email: string; browserToken: string}) => {
  const res = await axios.post(invalidateUrl, {email, browserToken})
  return res.data
}