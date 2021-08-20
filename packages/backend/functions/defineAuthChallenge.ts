import {
  DefineAuthChallengeTriggerEvent,
  DefineAuthChallengeTriggerHandler,
} from 'aws-lambda'

export const handler: DefineAuthChallengeTriggerHandler = async (event) => {
  console.log(`event:`, JSON.stringify(event))
  // Stop if user can't be found
  if (event.request.userNotFound) {
      event.response.failAuthentication = true;
      event.response.issueTokens = false;
      return event;
  }

  // Check result of last challenge
  if (event.request.session && event.request.session.length) {
      const lastSession = event.request.session.slice(-1)[0];
      // https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
      // You should always check challengeName in your DefineAuthChallenge Lambda trigger
      // to make sure it matches the expected value when determining if a user has successfully
      // authenticated and should be issued tokens.
      if (lastSession.challengeName === 'CUSTOM_CHALLENGE'
          && lastSession.challengeMetadata === 'SEND_CODE'
          && lastSession.challengeResult === true){
          // The user provided the right answer - issue their tokens
          event.response.failAuthentication = false;
          event.response.issueTokens = true;
          return event;
      }
  }

  // Present a new challenge if we haven't received a correct answer yet
  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = 'CUSTOM_CHALLENGE';
  console.log(`response:`, JSON.stringify(event.response))
  return event;

};

// TODO separate into functions like this example
export const handler_old: DefineAuthChallengeTriggerHandler = async (event) => {
  if (notCustomChallenge(event)) {
    // We only accept custom challenges; fail auth
    event.response.issueTokens = false
    event.response.failAuthentication = true
  } else if (tooManyFailedAttempts(event)) {
    // The user provided a wrong answer 3 times; fail auth
    event.response.issueTokens = false
    event.response.failAuthentication = true
  } else if (successfulAnswer(event)) {
    // The user provided the right answer; succeed auth
    event.response.issueTokens = true
    event.response.failAuthentication = false
  } else {
    // The user did not provide a correct answer yet; present challenge
    event.response.issueTokens = false
    event.response.failAuthentication = false
    event.response.challengeName = 'CUSTOM_CHALLENGE'
  }

  return event
}

export const notCustomChallenge = (event: DefineAuthChallengeTriggerEvent) =>
  event.request.session &&
  !!event.request.session.find(
    (attempt) => attempt.challengeName !== 'CUSTOM_CHALLENGE'
  )

export const tooManyFailedAttempts = (event: DefineAuthChallengeTriggerEvent) =>
  event.request.session &&
  event.request.session.length >= 3 &&
  event.request.session.slice(-1)[0].challengeResult === false

export const successfulAnswer = (event: DefineAuthChallengeTriggerEvent) =>
  event.request.session &&
  !!event.request.session.length &&
  event.request.session.slice(-1)[0].challengeName === 'CUSTOM_CHALLENGE' && // Doubly stitched, holds better
  event.request.session.slice(-1)[0].challengeResult === true
