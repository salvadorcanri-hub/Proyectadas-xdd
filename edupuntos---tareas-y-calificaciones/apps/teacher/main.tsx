import { createRoot } from 'react-dom/client';
import { SessionApp } from '../../src/SessionApp';
import { TeacherApp } from '../../src/apps/TeacherApp';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<SessionApp>{({state, user, onStateUpdate, onLogout}) => <TeacherApp state={state} onStateUpdate={onStateUpdate} onLogout={onLogout} / >}</SessionApp>);
