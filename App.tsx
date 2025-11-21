import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { Instagram, MessageCircle } from 'lucide-react';
import { AppProvider } from './context/AppContext';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import Newsletter from './components/Newsletter';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Profile from './pages/Profile';
import Ecosystem from './pages/Ecosystem';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import OrderCancel from './pages/OrderCancel';
import Admin from './pages/Admin';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';

const App = () => {
  return (
    <AppProvider>
      <HashRouter>
        <div className="min-h-screen flex flex-col font-sans text-white bg-black selection:bg-brand-accent selection:text-black">
          <Navbar />
          <CartDrawer />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/about" element={<About />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/ecosystem" element={<Ecosystem />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/success" element={<OrderSuccess />} />
              <Route path="/order/cancel" element={<OrderCancel />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </HashRouter>
    </AppProvider >
  );
};

export default App;