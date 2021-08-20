import * as React from 'react'
import { Route } from 'react-router-dom'

export const PassThroughRoute = ({
  children,
  ...rest
}: React.ComponentProps<typeof Route>) => {
  return (
    <Route
      {...rest}
      render={() =>
          children
      }
    />
  )
}
