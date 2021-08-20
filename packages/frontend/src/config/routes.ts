import { PrivateRoute } from 'components/PrivateRoute'
import { PublicRoute } from 'components/PublicRoute'
import { PassThroughRoute } from 'components/PassThroughRoute'
import * as React from 'react'
import { Route } from 'react-router-dom'

export type RouteItem = {
  path: string
  routePath: (args?: any) => string
  routeComponent: (props: React.ComponentProps<typeof Route>) => JSX.Element
  component: any
  exact?: boolean
}

export const routes: Record<string, RouteItem> = {
  home: {
    path: '/',
    routePath: () => '/',
    routeComponent: PrivateRoute,
    component: React.lazy(() => import('pages/Home/Home')),
    exact: true,
  },
  signIn: {
    path: '/signIn',
    routePath: () => '/signIn',
    routeComponent: PublicRoute,
    component: React.lazy(() => import('pages/SignIn/SignIn')),
  },
  signInWait: {
    path: '/signInWait',
    routePath: ({email, browserToken, browserRandom}: {email: string, browserToken: string, browserRandom: string}) => `/signInWait/${email},${browserToken},${browserRandom}`,
    routeComponent: PublicRoute,
    component: React.lazy(() => import('pages/SignInWait/SignInWait')),
  },
  verify: {
    path: '/verify',
    routePath: () => '/verify',
    routeComponent: PassThroughRoute,
    component: React.lazy(
      () => import('pages/VerifyMagicLink/VerifyMagicLink')
    ),
  },
}

export const renderRoutes = Object.entries(routes)
