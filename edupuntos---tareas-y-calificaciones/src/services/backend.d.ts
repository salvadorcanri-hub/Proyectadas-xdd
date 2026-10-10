declare module '#backend' {
  export const currentUser: typeof import('./supabase-api').currentUser;
  export const login: typeof import('./supabase-api').login;
  export const logout: typeof import('./supabase-api').logout;
  export const fetchState: typeof import('./supabase-api').fetchState;
  export const submitHomework: typeof import('./supabase-api').submitHomework;
  export const updateGrade: typeof import('./supabase-api').updateGrade;
  export const createAssignment: typeof import('./supabase-api').createAssignment;
  export const deleteAssignment: typeof import('./supabase-api').deleteAssignment;
  export const updateRewardsConfig: typeof import('./supabase-api').updateRewardsConfig;
  export const importExcelBase64: typeof import('./supabase-api').importExcelBase64;
  export const downloadExcel: typeof import('./supabase-api').downloadExcel;
  export const subscribeToRealtimeUpdates: typeof import('./supabase-api').subscribeToRealtimeUpdates;
}
