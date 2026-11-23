import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './state';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="loading-screen"><h1>Let’s try that again.</h1><p>MindPilot ran into a problem. Previously saved data is still in local storage.</p><button className="button button-primary" onClick={() => location.reload()}>Reload MindPilot</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><AppProvider><App/></AppProvider></ErrorBoundary></StrictMode>);
