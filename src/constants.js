export const STATUS_CONFIG = {
  intake: { label: 'INTAKE', color: '#7c6fcd', bg: 'rgba(124,111,205,.15)', stripe: '#7c6fcd' },
  fall_checklist: { label: 'FALL CHECK', color: '#e07b39', bg: 'rgba(224,123,57,.15)', stripe: '#e07b39' },
  storage: { label: 'IN STORAGE', color: '#5b9bd5', bg: 'rgba(91,155,213,.15)', stripe: '#5b9bd5' },
  service: { label: 'SERVICE', color: '#e07b39', bg: 'rgba(224,123,57,.15)', stripe: '#e07b39' },
  cleaning: { label: 'CLEANING', color: '#06b88a', bg: 'rgba(6,184,138,.15)', stripe: '#06b88a' },
  spring_checklist: { label: 'SPRING CHECK', color: '#52b788', bg: 'rgba(82,183,136,.15)', stripe: '#52b788' },
  ready: { label: 'READY', color: '#2da84f', bg: 'rgba(45,168,79,.15)', stripe: '#2da84f' },
  invoiced: { label: 'INVOICED', color: '#e8b42e', bg: 'rgba(232,180,46,.15)', stripe: '#e8b42e' },
  archived: { label: 'ARCHIVED', color: '#888', bg: 'rgba(136,136,136,.15)', stripe: '#888' },
}

export const STATUS_ORDER = Object.keys(STATUS_CONFIG)

export const THEMES = [
  { id: 'deep-water', name: 'Deep Water', icon: '\u{1F30A}', desc: 'Classic nautical' },
  { id: 'sunset-harbour', name: 'Sunset Harbour', icon: '\u{1F305}', desc: 'Warm & golden' },
  { id: 'storm-watch', name: 'Storm Watch', icon: '\u26C8\uFE0F', desc: 'Rugged & green' },
  { id: 'coral-bay', name: 'Coral Bay', icon: '\u{1F420}', desc: 'Bright & tropical' },
]

export const THEME_PREVIEW_COLORS = {
  'deep-water': { day: ['#0a4f6e', '#00b4d8', '#f0f7ff'], night: ['#061a24', '#0d2d3e', '#00b4d8'] },
  'sunset-harbour': { day: ['#b5440e', '#e87e3e', '#fff8f0'], night: ['#1a0a02', '#2d1508', '#e87e3e'] },
  'storm-watch': { day: ['#2d4a3e', '#52b788', '#f2f5f3'], night: ['#0a1510', '#152018', '#52b788'] },
  'coral-bay': { day: ['#c03a3a', '#06b88a', '#fff5f2'], night: ['#0f0505', '#200c0c', '#06b88a'] },
}

export const RECEIVED_ITEMS = [
  { key: 'battery', label: 'Battery' },
  { key: 'keys', label: 'Keys' },
  { key: 'cover', label: 'Cover' },
  { key: 'paddles', label: 'Paddles' },
  { key: 'life_jackets', label: 'Life Jackets' },
  { key: 'cushions', label: 'Cushions' },
  { key: 'gas_cans', label: 'Gas Cans' },
  { key: 'tie_ropes', label: 'Tie Ropes' },
  { key: 'lights', label: 'Lights' },
]

export const AUTHORIZED_WORK = [
  { key: 'oil_change', label: 'Oil & Filter' },
  { key: 'outdrive_service', label: 'Outdrive Svc' },
  { key: 'tune_up', label: 'Tune-Up' },
  { key: 'lower_unit_drain', label: 'Lower Unit' },
  { key: 'prop_rebuild', label: 'Prop Rebuild' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'delivery', label: 'Delivery' },
]

export const CONDITIONS = [
  { key: 'top', label: 'Top/Canvas' },
  { key: 'hull', label: 'Hull' },
  { key: 'upholstery', label: 'Upholstery' },
  { key: 'motor', label: 'Motor' },
  { key: 'propeller', label: 'Propeller' },
  { key: 'lower_unit', label: 'Lower Unit' },
]

export const CLEANING_ITEMS = [
  {
    cat: 'Interior',
    items: [
      { key: 'int_quick_wipe', label: 'Quick Wipe' },
      { key: 'int_power_wash', label: 'Power Wash' },
      { key: 'int_spotless', label: 'Make It Shiny & Spotless' },
    ],
  },
  {
    cat: 'Exterior',
    items: [
      { key: 'ext_quick_wipe', label: 'Quick Wipe' },
      { key: 'ext_power_wash', label: 'Power Wash' },
      { key: 'ext_algae_wax', label: 'Algae Strip & Wax' },
      { key: 'ext_buff_polish', label: 'Buff / Polish' },
    ],
  },
]

export const FALL_CHECKLIST = [
  {
    cat: 'Engine',
    items: [
      { key: 'oil_check_engine', label: 'Check engine oil level' },
      { key: 'oil_change_engine', label: 'Change engine oil & filter if needed' },
      { key: 'lower_unit_oil', label: 'Check & drain/refill lower unit oil' },
      { key: 'fog_engine', label: 'Fog engine with fogging oil' },
      { key: 'drain_engine', label: 'Drain water from engine / flush manifold' },
      { key: 'intake_manifold', label: 'Flush intake manifold with non-toxic antifreeze' },
    ],
  },
  {
    cat: 'Battery & Electrical',
    items: [
      { key: 'battery_remove', label: 'Remove & store battery' },
      { key: 'battery_charge', label: 'Put battery on trickle charger' },
      { key: 'lights_check', label: 'Check all lights working' },
    ],
  },
  {
    cat: 'Inspection',
    items: [
      { key: 'hull_inspect', label: 'Inspect hull for damage' },
      { key: 'prop_inspect', label: 'Inspect propeller' },
      { key: 'bilge_inspect', label: 'Check bilge pump operational' },
      { key: 'mechanical_notes', label: 'Note any mechanical issues for customer approval' },
    ],
  },
  {
    cat: 'Storage',
    items: [
      { key: 'drain_livewells', label: 'Drain all livewells / baitwells' },
      { key: 'remove_valuables', label: 'Remove valuables from boat' },
      { key: 'cover_secure', label: 'Secure cover' },
    ],
  },
]

export const SPRING_CHECKLIST = [
  {
    cat: 'Inspect',
    items: [
      { key: 'hull_inspect', label: 'Inspect hull — note any winter damage' },
      { key: 'bilge_inspect', label: 'Check bilge — clear of water & debris' },
    ],
  },
  {
    cat: 'Engine Recommission',
    items: [
      { key: 'battery_install', label: 'Install & connect battery' },
      { key: 'battery_test', label: 'Test battery charge & connections' },
      { key: 'oil_check', label: 'Check engine oil level' },
      { key: 'lower_unit_check', label: 'Check lower unit oil' },
      { key: 'engine_plugs', label: 'Install / check spark plugs' },
      { key: 'fuel_system', label: 'Check fuel system — no leaks' },
      { key: 'test_run', label: 'Test run engine — check all systems' },
    ],
  },
  {
    cat: 'Mechanical',
    items: [
      { key: 'trim_test', label: 'Test trim / tilt operation' },
      { key: 'steering_test', label: 'Test steering' },
      { key: 'prop_check', label: 'Check propeller — no damage' },
      { key: 'bilge_pump_test', label: 'Test bilge pump' },
    ],
  },
  {
    cat: 'Final',
    items: [
      { key: 'clean_interior', label: 'Clean interior' },
      { key: 'safety_check', label: 'Safety equipment present & serviceable' },
      { key: 'ready_for_water', label: 'Ready for water' },
    ],
  },
]

export const STORAGE_CHECKLIST = [
  {
    cat: 'Wrapping',
    items: [
      { key: 'wrap', label: 'Shrink wrap boat' },
    ],
  },
]

export const STORAGE_TYPES = [
  { key: 'customer_boathouse', label: 'Customer Boathouse', icon: '\u{1F3E0}' },
  { key: 'marina_boathouse', label: 'Marina Boathouse', icon: '\u{1F3E0}' },
  { key: 'storage_building', label: 'Storage Building', icon: '\u{1F3D7}\uFE0F' },
  { key: 'dry_land', label: 'Dry Land', icon: '\u{1F3D7}\uFE0F' },
  { key: 'covered', label: 'Covered', icon: '\u{1F3D5}\uFE0F' },
  { key: 'water', label: 'In Water', icon: '\u26F5' },
]

export const ROLE_COLORS = {
  admin: '#7c6fcd',
  office: '#5b9bd5',
  mechanic: '#e07b39',
  cleaner: '#06b88a',
  wrapper: '#52b788',
}
