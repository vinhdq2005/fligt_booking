import Header from '../components/Header'
import Footer from '../components/Footer'

type MainLayoutProps = {
  children: React.ReactNode
}

function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app">
      <Header />

      <main>
        {children}
      </main>

      <Footer />
    </div>
  )
}

export default MainLayout