import { useEffect } from 'react'
import useSWR, { SWRResponse } from 'swr'
import { getEffectivePorts } from '@renderer/utils/ipc'
import {
  subscribeCoreStarted,
  subscribeProfileReloaded
} from '@renderer/store/core-lifecycle-store'

export function useEffectivePorts(): SWRResponse<Record<MihomoPortKey, MihomoPortInfo>, Error> {
  const response = useSWR<Record<MihomoPortKey, MihomoPortInfo>, Error>(
    'getEffectivePorts',
    getEffectivePorts
  )
  const { mutate } = response

  useEffect(() => {
    const refresh = (): void => {
      void mutate()
    }
    const unsubscribeStarted = subscribeCoreStarted(refresh)
    const unsubscribeReloaded = subscribeProfileReloaded(refresh)
    return (): void => {
      unsubscribeStarted()
      unsubscribeReloaded()
    }
  }, [mutate])

  return response
}
