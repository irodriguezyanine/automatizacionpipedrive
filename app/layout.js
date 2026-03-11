import './globals.css'

export const metadata = {
  title: 'Vedisa Remates – Panel de correos',
  description: 'Aprobar y enviar correos de seguimiento desde Pipedrive',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
