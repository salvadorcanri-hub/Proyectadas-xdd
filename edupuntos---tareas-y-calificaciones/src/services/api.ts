// Vite resolves this facade to exactly one backend at build time. No Node server is bundled for Netlify.
export { currentUser, login, register, logout, fetchState, submitHomework, updateGrade, createAssignment, deleteAssignment, updateRewardsConfig, importExcelBase64, downloadExcel, subscribeToRealtimeUpdates } from '#backend';

export { selectClassroom, selectedClassroom } from './classroom-selection';
