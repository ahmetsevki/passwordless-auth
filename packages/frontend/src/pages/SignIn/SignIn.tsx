import * as React from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { useAuth } from 'config/auth'
import styles from './SignIn.module.css'
import { useHistory } from 'react-router-dom'
import { routes } from 'config/routes'

const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 6 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 16 },
  },
}

const tailFormItemLayout = {
  wrapperCol: {
    xs: {
      span: 24,
      offset: 0,
    },
    sm: {
      span: 16,
      offset: 6,
    },
  },
}

const SignIn = () => {
  const [loading, setLoading] = React.useState(false)
  const [redirect, setRedirect] = React.useState<string|null>(null)
  const { signIn } = useAuth()
  const history = useHistory()


  const onSubmit = async (values: any) => {
    try {
      console.log(`onSubmit - values`, values)
      setLoading(true)
      let response = await signIn(values)
      console.log(`result of signin: `, response)
      message.success(response.message, 5)
      setRedirect({...values, ...response})
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message, 4)
    } finally {
      setLoading(false)
    }
  }
  React.useEffect(() => {
      if(redirect){
        console.log(`redirecting with `, redirect)
        history.replace(routes.signInWait.routePath(redirect))
      }
  });
  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <h2>Sign In</h2>
        <Form
          name="SignIn"
          {...formItemLayout}
          onFinish={onSubmit}
          onFinishFailed={() => {
            console.log(`onFinishFailed`)
            message.error('Please check your email', 4)
          }}
        >
          <Form.Item
            label="Email"
            name="email"
            required
            rules={[{ type: 'email', required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item {...tailFormItemLayout}>
            <Button type="primary" htmlType="submit" loading={loading}>
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default SignIn
