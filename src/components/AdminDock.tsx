import { useEffect, useMemo, useState, type ReactNode } from 'react'

type AdminDockSection = {
  id: string
  icon: string
  label: string
  content: ReactNode
}

type AdminDockProps = {
  title: string
  sections: AdminDockSection[]
  className?: string
  onActiveSectionChange?: (sectionId: string | null) => void
}

const adminDockOpenEvent = 'admin-dock-open'

export function AdminDock({ title, sections, className, onActiveSectionChange }: AdminDockProps) {
  const [dockInstanceId] = useState(() => Math.random().toString(36).slice(2))
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? null,
    [sections, activeSectionId],
  )

  useEffect(() => {
    onActiveSectionChange?.(activeSectionId)
  }, [activeSectionId, onActiveSectionChange])

  useEffect(() => {
    const handleDockOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId?: string }>).detail
      if (!detail?.ownerId) {
        return
      }

      if (detail.ownerId !== dockInstanceId) {
        setActiveSectionId(null)
      }
    }

    window.addEventListener(adminDockOpenEvent, handleDockOpen)
    return () => {
      window.removeEventListener(adminDockOpenEvent, handleDockOpen)
    }
  }, [dockInstanceId])

  if (sections.length === 0) {
    return null
  }

  return (
    <aside className={`admin-dock ${className ?? ''}`.trim()} aria-label={title}>
      <div className="admin-dock-rail" role="tablist" aria-label={`${title} controls`}>
        {sections.map((section) => {
          const isActive = section.id === activeSectionId

          return (
            <button
              key={section.id}
              type="button"
              className={`admin-dock-icon${isActive ? ' active' : ''}`}
              title={section.label}
              role="tab"
              aria-selected={isActive}
              aria-controls={`admin-dock-panel-${section.id}`}
              onClick={() => {
                setActiveSectionId((current) => {
                  const next = current === section.id ? null : section.id
                  if (next) {
                    window.dispatchEvent(
                      new CustomEvent(adminDockOpenEvent, {
                        detail: { ownerId: dockInstanceId },
                      }),
                    )
                  }

                  return next
                })
              }}
            >
              <span aria-hidden="true">{section.icon}</span>
              <span className="admin-dock-sr">{section.label}</span>
            </button>
          )
        })}
      </div>

      {activeSection ? (
        <div id={`admin-dock-panel-${activeSection.id}`} className="admin-dock-panel panel" role="tabpanel">
          <h3>{activeSection.label}</h3>
          {activeSection.content}
        </div>
      ) : null}
    </aside>
  )
}
