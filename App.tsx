import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { Instagram, MessageCircle } from 'lucide-react';
import { AppProvider } from './context/AppContext';
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

const App = () => {
  return (
    <AppProvider>
      <HashRouter>
        <div className="min-h-screen flex flex-col font-sans text-brand-black bg-white selection:bg-brand-accent selection:text-white">
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="bg-brand-black text-white py-16 border-t border-gray-900">
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12">
              <div className="col-span-1 md:col-span-1">
                <h3 className="font-display text-xl font-bold uppercase mb-4">Coalition</h3>
                <p className="text-gray-500 text-sm">Crafted in Baltimore, Maryland.</p>
                <p className="text-gray-500 text-sm mt-2">© 2024 Coalition Brand.</p>
              </div>

              <div>
                <h4 className="font-bold uppercase mb-4 text-sm tracking-widest">Newsletter</h4>
                <p className="text-gray-500 text-xs mb-4">Sign up for exclusive drops and community updates.</p>
                <Newsletter />
              </div>

              <div>
                <h4 className="font-bold uppercase mb-4 text-sm tracking-widest">Support</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
                  <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="hover:text-white transition">Terms of Service</Link></li>
                  <li><a href="mailto:support@coalitionbrand.com" className="hover:text-white transition">Contact Us</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold uppercase mb-4 text-sm tracking-widest">Community</h4>
                <div className="flex flex-col items-start space-y-3 text-sm text-gray-400">
                  <a
                    href="https://www.instagram.com/sgcoalition"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wide hover:opacity-90 transition min-w-[140px]"
                  >
                    <Instagram className="w-4 h-4 mr-2" />
                    Instagram
                  </a>
                  <a
                    href="https://discord.gg/bByqsC5f5V"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center bg-[#5865F2] text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wide hover:bg-[#4752C4] transition min-w-[140px]"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Join Discord
                  </a>
                  <a href="#" className="hover:text-brand-accent transition pl-1">Twitter</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </HashRouter>
    </AppProvider >
  );
};

export default App;