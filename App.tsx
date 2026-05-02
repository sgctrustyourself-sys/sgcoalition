import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import AnnouncementBar from './components/AnnouncementBar';
import CartDrawer from './components/CartDrawer';
import RewardActivation from './components/RewardActivation';
import PageLoader from './components/ui/PageLoader';
import MobileBottomNav from './components/MobileBottomNav';
import ToastContainer from './components/ui/ToastContainer';
import SignalAlert from './components/SignalAlert';
import ProtectedRoute from './components/ProtectedRoute';
import { TutorialProvider } from './context/TutorialContext';
import { storeReferralCode } from './utils/referralSystem';

const AIChatWidget = React.lazy(() => import('./components/AIChatWidget'));
import { trackReferralEvent } from './utils/referralAnalytics';
import { supabase } from './services/supabase';

// Lazy Load Pages
const Home = React.lazy(() => import('./pages/Home'));
const Shop = React.lazy(() => import('./pages/Shop'));
const ProductDetails = React.lazy(() => import('./pages/ProductDetails'));
const About = React.lazy(() => import('./pages/About'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Membership = React.lazy(() => import('./pages/Membership'));
const Ecosystem = React.lazy(() => import('./pages/Ecosystem'));
const Archive = React.lazy(() => import('./pages/Archive'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const OrderSuccess = React.lazy(() => import('./pages/OrderSuccess'));
const OrderCancel = React.lazy(() => import('./pages/OrderCancel'));
const OrderDetails = React.lazy(() => import('./pages/OrderDetails'));
const Admin = React.lazy(() => import('./pages/Admin'));
const TreasuryPage = React.lazy(() => import('./pages/TreasuryPage'));
const WizardsDashboard = React.lazy(() => import('./pages/WizardsDashboard'));
const Blog = React.lazy(() => import('./pages/Blog'));
const BlogPostView = React.lazy(() => import('./pages/BlogPostView'));
const BlogManager = React.lazy(() => import('./pages/admin/BlogManager'));

const Privacy = React.lazy(() => import('./pages/Privacy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const UpdatePassword = React.lazy(() => import('./pages/UpdatePassword'));
const GiveawayEntry = React.lazy(() => import('./pages/GiveawayEntry'));
const YoutubeGiveaway = React.lazy(() => import('./pages/YoutubeGiveaway'));
const CustomInquiry = React.lazy(() => import('./pages/CustomInquiry'));
const BuySGCoin = React.lazy(() => import('./pages/BuySGCoin'));
const Favorites = React.lazy(() => import('./pages/Favorites'));
const OrderHistory = React.lazy(() => import('./pages/OrderHistory'));
const SavedAddresses = React.lazy(() => import('./pages/SavedAddresses'));
const MyReviews = React.lazy(() => import('./pages/MyReviews'));
const SearchResults = React.lazy(() => import('./pages/SearchResults'));
const PublicWishlist = React.lazy(() => import('./pages/PublicWishlist'));
const Help = React.lazy(() => import('./pages/Help'));
const SGCoinWelcome = React.lazy(() => import('./pages/tutorial/Welcome'));
const SGCoinMetaMask = React.lazy(() => import('./pages/tutorial/MetaMask'));
const SGCoinPolygon = React.lazy(() => import('./pages/tutorial/Polygon'));
const SGCoinFundWallet = React.lazy(() => import('./pages/tutorial/FundWallet'));
const SGCoinQuickSwap = React.lazy(() => import('./pages/tutorial/QuickSwap'));
const SGCoinUsing = React.lazy(() => import('./pages/tutorial/UsingSGCoin'));
const MigrationPage = React.lazy(() => import('./pages/MigrationPage'));
const SGCoalitionPortal = React.lazy(() => import('./pages/SGCoalitionPortal'));
const WizardsPortal = React.lazy(() => import('./pages/WizardsPortal'));
const LiveOrdersMap = React.lazy(() => import('./pages/LiveOrdersMap'));

// Component to handle referral code detection
const ReferralTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref');

    if (refCode) {
      console.log('[Referral] Detected referral code:', refCode);
      storeReferralCode(refCode);

      // Track the click
      trackReferralEvent(refCode, 'click');
    }
  }, [location]);

  return null;
};

// Handle Auth Events (Password Recovery)
const AuthEventHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

const LegacyHashRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return;

    const target = hash.slice(1);
    if (!target || target === '/') return;

    navigate(target, { replace: true });
  }, [navigate]);

  return null;
};

// Component to conditionally render navbar based on route
const ConditionalNav = () => {
  const location = useLocation();
  // Hide navbar on portal pages that have their own navigation
  const hideNavbar = ['/sgminiwizards', '/portal'].includes(location.pathname);

  if (hideNavbar) return null;

  return (
    <div className="sticky top-0 z-[60]">
      <AnnouncementBar />
      <Navbar />
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <TutorialProvider>
          <BrowserRouter>
            <LegacyHashRedirect />
            <AuthEventHandler />
            <ReferralTracker />
            <div className="min-h-screen flex flex-col font-sans text-white bg-black selection:bg-brand-accent selection:text-black">
              <SignalAlert />
              <ConditionalNav />
              <CartDrawer />
              <RewardActivation />
              <Suspense fallback={null}>
                <AIChatWidget />
              </Suspense>
              <ToastContainer />
              <main className="flex-grow">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/portal" element={<SGCoalitionPortal />} />
                    <Route path="/sgminiwizards" element={<WizardsPortal />} />
                    <Route path="/sgminiwizards/dashboard" element={<WizardsDashboard />} />
                    <Route path="/sgminiwizards/treasury" element={<TreasuryPage />} />
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
                    <Route path="/order/:orderId" element={<OrderDetails />} />
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
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route path="/giveaway/:id" element={<GiveawayEntry />} />
                    <Route path="/inquire" element={<CustomInquiry />} />
                    <Route path="/sgcoin" element={<BuySGCoin />} />
                    <Route path="/membership" element={<Membership />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPostView />} />
                    <Route path="/admin/blog" element={
                      <ProtectedRoute requireAdmin={true}>
                        <BlogManager />
                      </ProtectedRoute>
                    } />

                    {/* SGCoin Tutorial Routes */}
                    <Route path="/tutorial" element={<SGCoinWelcome />} />
                    <Route path="/tutorial/welcome" element={<SGCoinWelcome />} />
                    <Route path="/tutorial/metamask" element={<SGCoinMetaMask />} />
                    <Route path="/tutorial/polygon" element={<SGCoinPolygon />} />
                    <Route path="/tutorial/fund" element={<SGCoinFundWallet />} />
                    <Route path="/tutorial/quickswap" element={<SGCoinQuickSwap />} />
                    <Route path="/tutorial/use" element={<SGCoinUsing />} />

                    {/* Legacy Redirects */}
                    <Route path="/custom-inquiry" element={<Navigate to="/inquire" replace />} />
                    <Route path="/buy-sgcoin" element={<Navigate to="/sgcoin" replace />} />
                    <Route path="/tutorial/fund-wallet" element={<Navigate to="/tutorial/fund" replace />} />
                    <Route path="/tutorial/use-sgcoin" element={<Navigate to="/tutorial/use" replace />} />
                    <Route path="/migrate" element={<MigrationPage />} />
                    <Route path="/live-orders" element={<LiveOrdersMap />} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <MobileBottomNav />
              <SpeedInsights />
              <Analytics />
            </div>
          </BrowserRouter>
        </TutorialProvider>
      </AppProvider>
    </ToastProvider>
  );
};

export default App;
