import { createRoot } from 'react-dom/client';
import { SessionApp } from '../../src/SessionApp';
import { StudentApp } from '../../src/apps/StudentApp';
import '../../src/index.css';
createRoot(document.getElementById('root')!).render(<SessionApp>{({state, user, onStateUpdate, onLogout}) => <StudentApp state={state} onStateUpdate={onStateUpdate} onLogout={onLogout} activeStudentId={user.studentId!}/ >}</SessionApp>);
