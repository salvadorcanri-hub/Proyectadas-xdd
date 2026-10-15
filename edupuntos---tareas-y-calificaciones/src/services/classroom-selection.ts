// Per-tab selection. Every server operation still verifies classroom authorization.
let selected: string | null = null;
export function selectClassroom(id: string | null) { selected = id; }
export function selectedClassroom() { return selected; }
