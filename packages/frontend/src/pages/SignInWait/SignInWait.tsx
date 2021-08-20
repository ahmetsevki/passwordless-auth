import * as React from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { routes } from 'config/routes'
import { fetchEmailSecretWithBrowserSecret } from 'config/api'
import { useAuth } from 'config/auth'

const SignInWait = () => {
    const location = useLocation()
    const history = useHistory()
    const { answerCustomChallenge } = useAuth()

    const [error, setError] = React.useState(null);
    const [browserRandom, setBrowserRandom] = React.useState<string|null>(null)

    const finishSignin = async(challenge: string) => {
        console.log(`finishSignin: `, challenge)
        const [email, browserToken, browserRandom] = challenge.split(',');
        setBrowserRandom(browserRandom)
        try {
            const emailSecret = await fetchEmailSecretWithBrowserSecret({email, browserToken});
            console.log(`SignInWait: emailSecret: `, emailSecret)
            await answerCustomChallenge({email, browserToken, emailSecret, from: 'SignInWait'})    
            history.replace(routes.home.routePath())       
        }catch(e){
            console.log(e)
            setError(e)  
        }
    };

    React.useEffect(() => {
        console.log(`signinwait`, location)
        const challenge = location.pathname.split('/')[2]
        finishSignin(challenge).then(() => history.replace(routes.home.routePath()))        
    });
    
    if (error) {
        return (
            <>
                <h1>Failed finishing sign-in</h1>
                <pre>{JSON.stringify(error, null, 2)}</pre>
            </>
        );
    }

    return (
    <div><p>Please check your email and click on <b>{browserRandom}</b></p>
    <p>TODO: resend email link</p></div>);
}

export default SignInWait
