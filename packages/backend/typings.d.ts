declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_REGION: string
    SES_FROM_ADDRESS: string
    USER_POOL_ID: string
  }
}
