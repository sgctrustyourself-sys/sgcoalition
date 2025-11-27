import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import PageLoader from './components/ui/PageLoader';
import MobileBottomNav from './components/MobileBottomNav';
import ToastContainer from './components/ui/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import { TutorialProvider } from './context/TutorialContext';
import ChatWidget from './components/ChatWidget';

// Lazy Load Pages
const Home = React.lazy(() => import('./pages/Home'));
const Shop = React.lazy(() => import('./pages/Shop'));
const ProductDetails = React.lazy(() => import('./pages/ProductDetails'));
const About = React.lazy(() => import('./pages/About'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Ecosystem = React.lazy(() => import('./pages/Ecosystem'));
const Archive = React.lazy(() => import('./pages/Archive'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const OrderSuccess = React.lazy(() => import('./pages/OrderSuccess'));
const OrderCancel = React.lazy(() => import('./pages/OrderCancel'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Privacy = React.lazy(() => import('./pages/Privacy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const UpdatePassword = React.lazy(() => import('./pages/UpdatePassword'));
const GiveawayEntry = React.lazy(() => import('./pages/GiveawayEntry'));
const CustomInquiry = React.lazy(() => import('./pages/CustomInquiry'));
const BuySGCoin = React.lazy(() => import('./pages/BuySGCoin'));
const Favorites = React.lazy(() => import('./pages/Favorites'));
const OrderHistory = React.lazy(() => import('./pages/OrderHistory'));
const SavedAddresses = React.lazy(() => import('./pages/SavedAddresses'));
const MyReviews = React.lazy(() => import('./pages/MyReviews'));
const SearchResults = React.lazy(() => import('./pages/SearchResults'));
const PublicWishlist = React.lazy(() => import('./pages/PublicWishlist'));

// Tutorial Pages
const Welcome = React.lazy(() => import('./pages/tutorial/Welcome'));
const MetaMask = React.lazy(() => import('./pages/tutorial/MetaMask'));
const Polygon = React.lazy(() => import('./pages/tutorial/Polygon'));
const FundWallet = React.lazy(() => import('./pages/tutorial/FundWallet'));
const QuickSwap = React.lazy(() => import('./pages/tutorial/QuickSwap'));
const UsingSGCoin = React.lazy(() => import('./pages/tutorial/UsingSGCoin'));

const App = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <TutorialProvider>
          <HashRouter>
            <div className="min-h-screen flex flex-col font-sans text-white bg-black selection:bg-brand-accent selection:text-black">
              <Navbar />
              <CartDrawer />
              <ChatWidget />
              <ToastContainer />
              <main className="flex-grow">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/search" element={<SearchResults />} />
                    <Route path="/product/:id" element={<ProductDetails />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/wishlist/:shareId" element={<PublicWishlist />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/order-history" element={<OrderHistory />} />
                    <Route path="/saved-addresses" element={<SavedAddresses />} />
                    <Route path="/my-reviews" element={<MyReviews />} />
                    <Route path="/ecosystem" element={<Ecosystem />} />
                    <Route path="/archive" element={<Archive />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order/success" element={<OrderSuccess />} />
                    <Route path="/order/cancel" element={<OrderCancel />} />
                    <Route path="/admin" element={
                      <ProtectedRoute requireAdmin={true}>
                        <Admin />
                      </ProtectedRoute>
                    } />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route path="/giveaway/:id" element={<GiveawayEntry />} />
                    <Route path="/custom-inquiry" element={<CustomInquiry />} />
                    <Route path="/buy-sgcoin" element={<BuySGCoin />} />

                    {/* Tutorial Routes */}
                    <Route path="/tutorial/welcome" element={<Welcome />} />
                    <Route path="/tutorial/metamask" element={<MetaMask />} />
                    <Route path="/tutorial/polygon" element={<Polygon />} />
                    <Route path="/tutorial/fund-wallet" element={<FundWallet />} />
                    <Route path="/tutorial/quickswap" element={<QuickSwap />} />
                    <Route path="/tutorial/use-sgcoin" element={<UsingSGCoin />} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <MobileBottomNav />
              <SpeedInsights />
              <Analytics />
            </div>
          </HashRouter>
        </TutorialProvider>
      </AppProvider>
    </ToastProvider>
  );
};

export default App;