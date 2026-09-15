// Main App

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Film, Mic } from 'lucide-react';
import { TranscribePage } from './pages/TranscribePage.js';
import { DubbingPage } from './pages/DubbingPage.js';

export function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Film size={24} className="text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">
                MediaHub
              </span>
            </Link>

            <div className="flex items-center gap-8">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600 font-medium transition"
              >
                <Mic size={20} />
                Transcrever
              </Link>
              <Link
                to="/dub"
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600 font-medium transition"
              >
                <Film size={20} />
                Dublagem
              </Link>
            </div>
          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<TranscribePage />} />
          <Route path="/dub" element={<DubbingPage />} />
        </Routes>

        {/* Footer */}
        <footer className="bg-gray-50 border-t border-gray-200 mt-16">
          <div className="max-w-6xl mx-auto px-8 py-8 text-center text-gray-600 text-sm">
            <p>
              © 2024 MediaHub • Desenvolvido com{' '}
              <span className="text-red-500">❤️</span> usando React + Tailwind
            </p>
            <p className="mt-2">
              Tecnologia 100% open-source • Zero custos
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
