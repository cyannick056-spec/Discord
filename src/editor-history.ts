// One entry per gesture; repeated slider/wheel updates replace that entry.
// Snapshots are independent so duplicating lamps never links their settings.
export class EditorHistory<T> {
  private states: string[] = [];
  private index = -1;
  private group: string | undefined;
  reset(value: T) { this.states = [JSON.stringify(value)]; this.index = 0; this.endGroup(); }
  record(value: T, group?: string) {
    const state = JSON.stringify(value);
    if (state === this.states[this.index]) return;
    this.states.splice(this.index + 1);
    if (group && group === this.group && this.index > 0) this.states[this.index] = state;
    else { this.states.push(state); this.index++; }
    if (this.states.length > 81) { this.states.shift(); this.index--; }
    this.group = group;
  }
  endGroup() { this.group = undefined; }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.states.length - 1; }
  undo(): T | undefined { this.endGroup(); return this.canUndo ? JSON.parse(this.states[--this.index]) : undefined; }
  redo(): T | undefined { this.endGroup(); return this.canRedo ? JSON.parse(this.states[++this.index]) : undefined; }
}
