import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#151829', border: '1px solid #ef4444', borderRadius: 8, padding: 32, maxWidth: 600, color: '#e2e8f0', fontFamily: 'system-ui' }}>
            <h2 style={{ color: '#f87171', marginBottom: 12 }}>Dashboard Error</h2>
            <pre style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{this.state.error.toString()}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
