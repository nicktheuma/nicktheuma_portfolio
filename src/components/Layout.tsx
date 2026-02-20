import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { AdminDock } from './AdminDock'
import { useSiteContent } from '../content/use-site-content'

const navItems = [
  { to: '/', label: 'Home', end: true },
]

export function Layout() {
  const {
    isAdmin,
    unlockAdmin,
    lockAdmin,
    clearOverrides,
    updateAdminCode,
    siteSettings,
    updateSiteSettings,
  } = useSiteContent()
  const [accessCode, setAccessCode] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [isUnlockOpen, setIsUnlockOpen] = useState(false)
  const [newAdminCode, setNewAdminCode] = useState('')
  const [confirmAdminCode, setConfirmAdminCode] = useState('')
  const [adminCodeFeedback, setAdminCodeFeedback] = useState('')

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.ctrlKey || event.metaKey || event.altKey || isAdmin) {
        return
      }

      if (isUnlockOpen) {
        setIsUnlockOpen(false)
        setAccessCode('')
        setUnlockError('')
        return
      }

      setIsUnlockOpen(true)
      setUnlockError('')
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isAdmin, isUnlockOpen])

  const handleUnlock = () => {
    if (unlockAdmin(accessCode)) {
      setUnlockError('')
      setAccessCode('')
      setIsUnlockOpen(false)
      return
    }

    setUnlockError('Incorrect admin code')
  }

  const handleAdminCodeUpdate = () => {
    const normalizedNewCode = newAdminCode.trim()
    const normalizedConfirmCode = confirmAdminCode.trim()

    if (normalizedNewCode.length < 4) {
      setAdminCodeFeedback('Admin code must be at least 4 characters.')
      return
    }

    if (normalizedNewCode !== normalizedConfirmCode) {
      setAdminCodeFeedback('Admin code confirmation does not match.')
      return
    }

    updateAdminCode(normalizedNewCode)
    setNewAdminCode('')
    setConfirmAdminCode('')
    setAdminCodeFeedback('Admin code updated.')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <h1 className="brand">
          <Link to="/">{siteSettings.brandName}</Link>
        </h1>
        <nav className="site-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}

          {isAdmin ? (
            <button type="button" className="admin-button" onClick={lockAdmin}>
              Exit admin
            </button>
          ) : null}
        </nav>
      </header>

      {!isAdmin && isUnlockOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Admin access">
          <div className="admin-modal">
            <h2>Admin access</h2>
            <input
              type="password"
              className="admin-input"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleUnlock()
                }
              }}
              placeholder="Enter admin code"
              aria-label="Admin code"
              autoFocus
            />
            <div className="admin-modal-actions">
              <button type="button" className="admin-button" onClick={handleUnlock}>
                Unlock
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setIsUnlockOpen(false)
                  setAccessCode('')
                  setUnlockError('')
                }}
              >
                Cancel
              </button>
            </div>
            {unlockError ? <p className="admin-error">{unlockError}</p> : null}
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <AdminDock
          title="Site admin"
          className="admin-dock-layout"
          sections={[
            {
              id: 'site-settings',
              icon: '⚙',
              label: 'Site settings',
              content: (
                <div className="admin-panel">
                  <label className="search-label" htmlFor="site-brand-name">
                    Brand name
                  </label>
                  <input
                    id="site-brand-name"
                    className="search-input"
                    value={siteSettings.brandName}
                    onChange={(event) => updateSiteSettings({ brandName: event.target.value })}
                  />

                  <label className="search-label" htmlFor="site-footer-text">
                    Footer text
                  </label>
                  <textarea
                    id="site-footer-text"
                    className="admin-textarea"
                    value={siteSettings.footerText}
                    onChange={(event) => updateSiteSettings({ footerText: event.target.value })}
                  />

                  <label className="search-label" htmlFor="site-admin-code">
                    New admin code
                  </label>
                  <input
                    id="site-admin-code"
                    type="password"
                    className="search-input"
                    value={newAdminCode}
                    onChange={(event) => {
                      setNewAdminCode(event.target.value)
                      setAdminCodeFeedback('')
                    }}
                    placeholder="Enter new admin code"
                  />

                  <label className="search-label" htmlFor="site-admin-code-confirm">
                    Confirm admin code
                  </label>
                  <input
                    id="site-admin-code-confirm"
                    type="password"
                    className="search-input"
                    value={confirmAdminCode}
                    onChange={(event) => {
                      setConfirmAdminCode(event.target.value)
                      setAdminCodeFeedback('')
                    }}
                    placeholder="Re-enter new admin code"
                  />

                  <button type="button" className="admin-button" onClick={handleAdminCodeUpdate}>
                    Update admin code
                  </button>

                  {adminCodeFeedback ? <p className="admin-error">{adminCodeFeedback}</p> : null}

                  <button type="button" className="admin-button" onClick={clearOverrides}>
                    Reset all saved admin changes
                  </button>
                </div>
              ),
            },
          ]}
        />
      ) : null}

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">{siteSettings.footerText}</footer>
    </div>
  )
}