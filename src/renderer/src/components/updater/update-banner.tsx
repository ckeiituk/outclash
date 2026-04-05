import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { CircleFadingArrowUp, X } from 'lucide-react'
import UpdaterModal from './updater-modal'
import { cancelUpdate } from '@renderer/utils/ipc'

interface Props {
  version: string
  changelog: string
}

const UpdateBanner: React.FC<Props> = ({ version, changelog }) => {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    downloading: boolean
    progress: number
    error?: string
  }>({ downloading: false, progress: 0 })

  React.useEffect(() => {
    const handleUpdateStatus = (
      _: Electron.IpcRendererEvent,
      status: typeof updateStatus
    ): void => {
      setUpdateStatus(status)
    }
    window.electron.ipcRenderer.on('update-status', handleUpdateStatus)
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('update-status')
    }
  }, [])

  if (dismissed) return null

  return (
    <>
      {openModal && (
        <UpdaterModal
          version={version}
          changelog={changelog}
          updateStatus={updateStatus}
          onCancel={async () => {
            try {
              await cancelUpdate()
              setUpdateStatus({ downloading: false, progress: 0 })
            } catch {}
          }}
          onClose={() => setOpenModal(false)}
        />
      )}
      <div className="animate-slide-down fixed top-8 left-0 right-0 z-50 flex items-center justify-center gap-3 bg-primary/95 backdrop-blur-sm px-4 py-1.5 text-primary-foreground text-sm shadow-md">
        <CircleFadingArrowUp className="size-4 shrink-0 animate-pulse" />
        <span>{t('updater.versionReady', { version })}</span>
        <Button
          size="sm"
          variant="secondary"
          className="h-6 px-3 text-xs"
          onClick={() => setOpenModal(true)}
        >
          {t('updater.updateNow')}
        </Button>
        <button
          className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20 transition-colors"
          onClick={() => setDismissed(true)}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </>
  )
}

export default UpdateBanner
