import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastContainer } from './components/Toast'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            <App />
            <ToastContainer />
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
