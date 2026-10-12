import Header from '../components/Header'
import Footer from '../components/Footer'
import { Outlet } from 'react-router-dom'

function MainLayout() {
  return (
    <div className="app">
      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

export default MainLayout