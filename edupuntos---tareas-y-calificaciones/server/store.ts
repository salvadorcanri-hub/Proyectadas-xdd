import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppState } from '../src/types';
import { seedState } from './seed';
import { CLASSROOMS, validateClassroom } from '../src/utils/classrooms';
import { storePhoto } from './photos';

export class Store {
  db: DatabaseSync;
  constructor(public dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dataDir, 'edupuntos.sqlite'));
    try {
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id),
        assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        payload TEXT NOT NULL, UNIQUE(student_id, assignment_id));
      CREATE TABLE IF NOT EXISTS grades (
        student_id TEXT NOT NULL REFERENCES students(id), assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        payload TEXT NOT NULL, PRIMARY KEY(student_id, assignment_id));
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')),
        student_id TEXT REFERENCES students(id), CHECK((role='student') = (student_id IS NOT NULL)));
      CREATE TABLE IF NOT EXISTS classrooms (id TEXT PRIMARY KEY, grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 5), section TEXT NOT NULL CHECK(section IN ('A','B','C','D')), UNIQUE(grade,section));
      CREATE TABLE IF NOT EXISTS teacher_classrooms (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, classroom_id TEXT NOT NULL REFERENCES classrooms(id), PRIMARY KEY(user_id,classroom_id));
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS student_accounts (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        dni TEXT NOT NULL UNIQUE CHECK(length(dni)=8 AND dni NOT GLOB '*[^0-9]*'),
        first_name TEXT NOT NULL, last_name TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS revoke_changed_account_sessions
      AFTER UPDATE OF role, student_id, password_hash ON users
      WHEN NEW.role IS NOT OLD.role OR NEW.student_id IS NOT OLD.student_id OR NEW.password_hash IS NOT OLD.password_hash
      BEGIN DELETE FROM sessions WHERE user_id=OLD.id; END;
    `);
    for (const classroom of CLASSROOMS) this.db.prepare('INSERT OR IGNORE INTO classrooms VALUES (?,?,?)').run(classroom.id, classroom.grade, classroom.section);
    if (!this.db.prepare("SELECT 1 FROM settings WHERE key='initialized'").get()) {
      const legacy = path.join(dataDir, 'db.json');
      // Parse failures abort startup; never silently replace existing school data with a demo.
      const state: AppState = existsSync(legacy) ? JSON.parse(readFileSync(legacy, 'utf8')) : seedState();
      if (existsSync(legacy) && !existsSync(`${legacy}.backup`)) copyFileSync(legacy, `${legacy}.backup`);
      for (const submission of state.submissions) {
        if (submission.photoUrl.startsWith('data:')) submission.photoUrl = storePhoto(dataDir, submission.photoUrl);
      }
      this.save(state);
    }
    } catch (error) { this.db.close(); throw error; }
  }

  load(): AppState {
    const rows = (table: string) => this.db.prepare(`SELECT payload FROM ${table} ORDER BY rowid`).all().map(r => JSON.parse(r.payload as string));
    return { students: rows('students'), assignments: rows('assignments'), submissions: rows('submissions'), grades: rows('grades'),
      rewards: JSON.parse(this.db.prepare("SELECT value FROM settings WHERE key='rewards'").get()!.value as string) };
  }

  save(state: AppState) {
    for (const item of [...state.students, ...state.assignments]) if (item.classroomId != null) validateClassroom(item.classroomId);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const student = this.db.prepare('INSERT INTO students VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, payload=excluded.payload WHERE payload != excluded.payload');
      for (const s of state.students) student.run(s.id, s.code, JSON.stringify(s));
      const assignment = this.db.prepare('INSERT INTO assignments VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload != excluded.payload');
      for (const a of state.assignments) assignment.run(a.id, JSON.stringify(a));
      const ids = new Set(state.assignments.map(a => a.id));
      for (const a of this.db.prepare('SELECT id FROM assignments').all()) {
        if (!ids.has(a.id as string)) this.db.prepare('DELETE FROM assignments WHERE id=?').run(a.id);
      }
      const submissionIds = new Set(state.submissions.map(s => s.id));
      for (const row of this.db.prepare('SELECT id FROM submissions').all()) {
        if (!submissionIds.has(row.id as string)) this.db.prepare('DELETE FROM submissions WHERE id=?').run(row.id);
      }
      const gradeIds = new Set(state.grades.map(g => JSON.stringify([g.studentId, g.assignmentId])));
      for (const row of this.db.prepare('SELECT student_id, assignment_id FROM grades').all()) {
        if (!gradeIds.has(JSON.stringify([row.student_id, row.assignment_id]))) this.db.prepare('DELETE FROM grades WHERE student_id=? AND assignment_id=?').run(row.student_id, row.assignment_id);
      }
      const submission = this.db.prepare('INSERT INTO submissions VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE payload != excluded.payload');
      for (const s of state.submissions) submission.run(s.id, s.studentId, s.assignmentId, JSON.stringify(s));
      const grade = this.db.prepare('INSERT INTO grades VALUES (?, ?, ?) ON CONFLICT(student_id, assignment_id) DO UPDATE SET payload=excluded.payload WHERE payload != excluded.payload');
      for (const g of state.grades) grade.run(g.studentId, g.assignmentId, JSON.stringify(g));
      this.db.prepare("INSERT INTO settings VALUES ('rewards', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(state.rewards));
      this.db.prepare("INSERT OR IGNORE INTO settings VALUES ('initialized', '1')").run();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
