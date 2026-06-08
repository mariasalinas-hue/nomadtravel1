import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Login from '@/components/Login';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import AdminRoute from '@/components/AdminRoute';
import ClientTripForm from '@/pages/ClientTripForm';
import ClientIntakeForm from '@/pages/ClientIntakeForm';
import TripRequestForm from '@/pages/TripRequestForm';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { SpoofProvider } from '@/contexts/SpoofContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoaded, isSignedIn } = useUser();

  // Show loading spinner while checking auth
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isSignedIn) {
    return <Login />;
  }

  // Render the main app
  return (
    <SpoofProvider>
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        // Verificar si la página es de administrador
        const isAdminPage = path.startsWith('Admin');

        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              isAdminPage ? (
                <AdminRoute>
                  <LayoutWrapper currentPageName={path}>
                    <Page />
                  </LayoutWrapper>
                </AdminRoute>
              ) : (
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              )
            }
          />
        );
      })}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </ErrorBoundary>
    </SpoofProvider>
  );
};


function App() {

  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          {/* Public routes - no authentication required */}
          <Route path="/public/trip-form/:token" element={<ClientTripForm />} />
          <Route path="/public/client-form/:token" element={<ClientIntakeForm />} />
          <Route path="/c/:token" element={<ClientIntakeForm />} />
          <Route path="/t/:clientId" element={<TripRequestForm />} />

          {/* All other routes - authentication required */}
          <Route path="*" element={
            <>
              <header>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </header>
              <NavigationTracker />
              <AuthenticatedApp />
            </>
          } />
        </Routes>
        <Toaster />
        <VisualEditAgent />
      </Router>
    </QueryClientProvider>
  )
}

export default App
