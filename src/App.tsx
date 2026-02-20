import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './components/Layout'
import { validateProjectData } from './content/media'
import { SiteContentProvider } from './content/site-content'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'

if (import.meta.env.DEV) {
  const validationErrors = validateProjectData()
  if (validationErrors.length > 0) {
    console.warn('Project data validation errors:\n' + validationErrors.map((item) => `- ${item}`).join('\n'))
  }
}

function App() {
  return (
    <SiteContentProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="projects/:slug" element={<ProjectPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SiteContentProvider>
  )
}

export default App
