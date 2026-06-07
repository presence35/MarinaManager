export function getToken() {
  return localStorage.getItem('marina_token') || ''
}

export async function api(method, path, body, isFormData) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${getToken()}` },
  }
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  } else if (isFormData) {
    opts.body = body
  }
  const res = await fetch(`/api${path}`, opts)
  if (res.status === 401) {
    localStorage.removeItem('marina_token')
    localStorage.removeItem('marina_employee')
    window.location.reload()
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}
