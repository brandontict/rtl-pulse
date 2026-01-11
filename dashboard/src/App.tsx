import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Radio, LayoutDashboard, History, Settings, Activity, Cpu } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import HistoryPage from './pages/History'
import Devices from './pages/Devices'
import SettingsPage from './pages/Settings'
import ConfigurationPage from './pages/Configuration'

function App() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/history', label: 'History', icon: History },
    { path: '/devices', label: 'Devices', icon: Radio },
    { path: '/config', label: 'Configuration', icon: Cpu },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="h-8 w-8 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">RTL-SDR Dashboard</h1>
          </div>
          <nav className="flex space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                  location.pathname === path
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/config" element={<ConfigurationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
