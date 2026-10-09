import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { FullPageSpinner } from '@/components/ui/Spinner';

const ChatPage = lazy(() => import('@/pages/ChatPage'));
const Auth = lazy(() => import('@/pages/Auth'));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route index element={<ChatPage />} />
          <Route path="c/:id" element={<ChatPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
