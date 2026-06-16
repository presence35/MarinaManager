import { useState, useCallback, useContext } from 'react'
import { AuthCtx } from './contexts/AuthCtx'
import { NavCtx } from './contexts/NavCtx'
import Icon from './components/Icon'
import CardsScreen from './screens/CardsScreen'
import CustomersScreen from './screens/CustomersScreen'
import BoatsScreen from './screens/BoatsScreen'
import CardDetailScreen from './screens/CardDetailScreen'
import NewCardScreen from './screens/NewCardScreen'
import NewLogScreen from './screens/NewLogScreen'
import MapScreen from './screens/MapScreen'
import SettingsScreen from './screens/SettingsScreen'
import AdminScreen from './screens/AdminScreen'
import CustomerDetailScreen from './screens/CustomerDetailScreen'

const NAV_ITEMS = [
  { key: 'cards', label: 'Cards', icon: 'id-card' },
  { key: 'customers', label: 'People', icon: 'user' },
  { key: 'boats', label: 'Boats', icon: 'boat' },
  { key: 'map', label: 'Map', icon: 'map' },
  { key: 'settings', label: 'Setup', icon: 'settings' },
]

export default function AppShell() {
  const { employee } = useContext(AuthCtx)
  const [screenStack, setScreenStack] = useState([
    { screen: 'cards', params: {} },
  ])
  const current = screenStack[screenStack.length - 1]

  const navigate = useCallback((screen, params = {}) => {
    setScreenStack((prev) => [...prev, { screen, params }])
  }, [])

  const goBack = useCallback(() => {
    setScreenStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  const activeNav = ['map', 'settings', 'cards', 'customers', 'boats'].includes(current.screen) ? current.screen : ''

  const renderScreen = () => {
    switch (current.screen) {
      case 'cards': return <CardsScreen params={current.params} />
      case 'customers': return <CustomersScreen />
      case 'boats': return <BoatsScreen params={current.params} />
      case 'card': return <CardDetailScreen params={current.params} />
      case 'new-card': return <NewCardScreen params={current.params} />
      case 'new-log': return <NewLogScreen params={current.params} />
      case 'map': return <MapScreen />
      case 'settings': return <SettingsScreen />
      case 'admin': return <AdminScreen params={current.params} />
      case 'customer-detail': return <CustomerDetailScreen params={current.params} />
      default: return <CardsScreen />
    }
  }

  return (
    <NavCtx.Provider value={{ navigate, goBack }}>
      <div className="app-shell">
        <div className="screen-body">{renderScreen()}</div>
        <div className="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => setScreenStack([{ screen: item.key, params: {} }])}
            >
              <span className="nav-item-icon"><Icon name={item.icon} size={24} /></span>
            </button>
          ))}
        </div>
      </div>
    </NavCtx.Provider>
  )
}
