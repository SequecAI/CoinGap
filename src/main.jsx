import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import LabPage from './lab/LabPage.jsx'
import './index.css' // ★ 이 줄이 반드시 있어야 합니다 ★

const GOOGLE_CLIENT_ID = '874558352527-jpjfa7i23vrk9l30jq1od5vg93ko9g99.apps.googleusercontent.com';

if (!Capacitor.isNativePlatform()) {
  const adsenseScript = document.createElement('script');
  adsenseScript.async = true;
  adsenseScript.crossOrigin = 'anonymous';
  adsenseScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7947485317948024';
  document.head.appendChild(adsenseScript);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Routes>
          <Route path="/lab/*" element={<LabPage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)