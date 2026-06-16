import { useEffect, useRef } from 'react'

export default function QrCode({ value, size = 80 }) {
  const containerRef = useRef(null)
  const qrRef = useRef(null)

  useEffect(() => {
    if (!value || !containerRef.current) return

    import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (qrRef.current) {
        qrRef.current.update({
          width: size,
          height: size,
          data: value,
        })
        return
      }

      const qrCode = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        margin: 1,
        dotsOptions: { color: '#000', type: 'rounded' },
        cornersSquareOptions: { color: '#000', type: 'extra-rounded' },
        cornersDotOptions: { color: '#000', type: 'dot' },
        backgroundOptions: { color: '#fff' },
      })

      qrCode.append(containerRef.current)
      qrRef.current = qrCode
    }).catch(() => {})
  }, [value, size])

  if (!value) return null

  return <div ref={containerRef} style={{ width: size, height: size, borderRadius: 6 }} />
}
