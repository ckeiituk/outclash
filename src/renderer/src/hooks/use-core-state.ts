import { useEffect } from 'react'
import useSWR, { SWRResponse } from 'swr'
import { getCoreState, onIpc } from '@renderer/utils/ipc'

export function useCoreState(): SWRResponse<CoreState, Error> {
  const response = useSWR<CoreState, Error>('getCoreState', getCoreState)
  const { mutate } = response
  useEffect(
    () =>
      onIpc<[CoreState]>('coreStateChanged', (state: CoreState) => {
        void mutate(state, { revalidate: false })
      }),
    [mutate]
  )
  return response
}
