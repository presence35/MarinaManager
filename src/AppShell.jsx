import { useState, useCallback, useContext, useEffect, useRef } from 'react'
import { AuthCtx } from './contexts/AuthCtx'
import { NavCtx } from './contexts/NavCtx'
import Icon from './components/Icon'
import ConfirmLeaveDialog from './components/ConfirmLeaveDialog'
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
  const stackRef = useRef(screenStack)
  stackRef.current = screenStack
  const isPoppingRef = useRef(false)
  const current = screenStack[screenStack.length - 1]

  const dirtyRef = useRef(false)
  const [pendingNav, setPendingNav] = useState(null)

  const setDirty = useCallback((val) => {
    dirtyRef.current = !!val
  }, [])

  useEffect(() => {
    window.history.replaceState({ idx: 0 }, '')
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const stack = stackRef.current
      if (stack.length > 1) {
        if (dirtyRef.current) {
          window.history.pushState({}, '')
          setPendingNav({ type: 'pop' })
          return
        }
        isPoppingRef.current = true
        setScreenStack(prev => prev.slice(0, -1))
      } else {
        window.history.pushState({ idx: 0 }, '')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const navigate = useCallback((screen, params = {}) => {
    if (dirtyRef.current) {
      setPendingNav({ type: 'navigate', screen, params })
      return
    }
    window.history.pushState({ screen, params }, '')
    setScreenStack((prev) => [...prev, { screen, params }])
  }, [])

  const goBack = useCallback(() => {
    if (stackRef.current.length > 1) {
      if (dirtyRef.current) {
        setPendingNav({ type: 'pop' })
        return
      }
      window.history.back()
    }
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

  const handleNavTap = useCallback((key) => {
    if (dirtyRef.current) {
      setPendingNav({ type: 'nav', key })
      return
    }
    window.history.replaceState({ idx: 0 }, '')
    setScreenStack([{ screen: key, params: {} }])
  }, [])

  const handleDiscard = useCallback(() => {
    dirtyRef.current = false
    const action = pendingNav
    setPendingNav(null)
    if (!action) return
    if (action.type === 'navigate') {
      window.history.pushState({ screen: action.screen, params: action.params }, '')
      setScreenStack((prev) => [...prev, { screen: action.screen, params: action.params }])
    } else if (action.type === 'pop') {
      window.history.back()
    } else if (action.type === 'nav') {
      window.history.replaceState({ idx: 0 }, '')
      setScreenStack([{ screen: action.key, params: {} }])
    }
  }, [pendingNav])

  const handleKeep = useCallback(() => {
    setPendingNav(null)
  }, [])

  return (
    <NavCtx.Provider value={{ navigate, goBack, setDirty }}>
      <div className="app-shell">
        <div className="screen-body">{renderScreen()}</div>
        <div className="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
              onClick={() => handleNavTap(item.key)}
            >
              <span className="nav-item-icon"><Icon name={item.icon} size={24} /></span>
            </button>
          ))}
        </div>
      </div>
      {pendingNav && <ConfirmLeaveDialog onDiscard={handleDiscard} onKeep={handleKeep} />}
    </NavCtx.Provider>
  )
}
