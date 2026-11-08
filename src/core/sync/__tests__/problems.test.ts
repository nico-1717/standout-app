import { groupOf, reasonKey } from '../problems';

describe('problem helpers', () => {
  test('every synced table maps to an area name', () => {
    expect(groupOf('todos')).toBe('todo');
    expect(groupOf('todo_buy_categories')).toBe('todo');
    expect(groupOf('habit_logs')).toBe('habits');
    expect(groupOf('pill_doses')).toBe('pills');
    expect(groupOf('diary_list_items')).toBe('diary');
    expect(groupOf('planner_events')).toBe('planner');
    expect(groupOf('projects')).toBe('projects');
    expect(groupOf('pomodoro_sessions')).toBe('pomodoro');
    expect(groupOf('university_exams')).toBe('grades');
    expect(groupOf('fc_games')).toBe('flashcards');
    expect(groupOf('whatever')).toBe('altro');
  });

  test('server codes map to a reason text, unknown ones to the general one', () => {
    expect(reasonKey('forbidden')).toBe('app.sync_motivo_forbidden');
    expect(reasonKey('nope')).toBe('app.sync_motivo_altro');
  });
});
