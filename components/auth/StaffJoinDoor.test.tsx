import { joinLines } from './StaffJoinDoor';

describe('joinLines', () => {
  it('names the bar that asked', () => {
    expect(joinLines('Caretaker’s', true).body).toBe('Caretaker’s asked you on. You’ll see tonight’s menu, the specs and the prep list.');
  });

  it('says the team when the bar has no name', () => {
    expect(joinLines('  ', false).body).toBe('The team asked you on. You’ll see tonight’s menu, the specs and the prep list.');
  });
});
