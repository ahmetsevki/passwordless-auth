import * as React from 'react'
import { useAuth } from 'config/auth'
import { useHistory, useLocation } from 'react-router-dom'
import { routes } from 'config/routes'
import { invalidateAuth } from 'config/api'


const VerifyMagicLink = () => {
  const { answerCustomChallenge } = useAuth()
  const location = useLocation()
  const history = useHistory()


  React.useEffect(() => {
    console.log(location);
    const [email, emailSecret, browserToken] = location.pathname.split('/')[2].split(',')
    if (emailSecret === 'invalidate'){
      //await axios.post(invalidateUrl, {email, browserToken})
      console.log(`calling invalidateAuth`)
      invalidateAuth({email, browserToken}).then( () => {
        history.replace(routes.signIn.routePath())
      })
      return;
    }
    answerCustomChallenge({email, browserToken, emailSecret, from: 'VerifyMagicLink'})
      .then(() => {
        history.replace(routes.home.routePath())
      })
      .catch((e) => {
        console.log(e)
        history.replace(routes.signIn.routePath())
      })
  }, [])

  return <div></div>
}

export default VerifyMagicLink
