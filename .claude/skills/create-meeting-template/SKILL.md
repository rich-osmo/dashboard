---
name: create-meeting-template
description: This skill should be used when the user asks to "create a meeting template", "set up a meeting agenda", "prep for upcoming meeting", "create 1:1 template", or wants to prepare a structured template for an upcoming meeting with a team member.
version: 1.0.0
---

# Create Meeting Template

This skill helps you create structured templates for upcoming meetings with team members. It generates properly formatted markdown files with agenda sections, space for notes, and follows your team's documentation structure.

## Overview

Creating meeting templates before a 1:1 or team meeting helps you:
- Prepare an agenda with topics to discuss
- Provide structure during the meeting
- Ensure consistent documentation across meetings
- Track follow-ups from previous meetings

## When This Skill Applies

Use this skill when you want to:
- Create a template for an upcoming 1:1 meeting
- Set up an agenda for a team discussion
- Prepare a structured meeting file before the meeting happens
- Create a follow-up meeting template based on previous discussions

## How It Works

### Step 1: Gather Meeting Information

Ask the user for:
- **Who**: Team member name (e.g., "Wesley Qian", "Karen Mak")
- **When**: Meeting date (e.g., "February 15, 2026", "next Tuesday")
- **Topics**: What topics to discuss (optional - can leave sections empty)
- **Follow-ups**: Any action items or topics from previous meeting to include

### Step 2: Check Previous Meeting

Look for the most recent meeting file for this team member:

```
/Users/rich/osmo/rich/teams/{Team_Member_Name}/meetings/
```

If a recent meeting exists:
- Read the action items
- Note any follow-up topics
- Carry forward incomplete items into the new template

### Step 3: Create Template File

Create a new meeting file at:

```
/Users/rich/osmo/rich/teams/{Team_Member_Name}/meetings/1n1-YYYY-MM-DD.md
```

Use the meeting template format (see below).

### Step 4: Optional - Add to Running Notes

Ask if the user wants to add a link or reference to this upcoming meeting in the team member's running `1-1.md` file.

## Meeting Template Format

### Standard 1:1 Template

```markdown
# 1:1 Meeting: {Name} / Rich

**Date:** {Month Day, Year}
**Status:** Upcoming / Scheduled

## Agenda

### Follow-ups from Last Meeting
{Pull from previous meeting's action items}

- [ ] Topic 1 - {description}
- [ ] Topic 2 - {description}

### Topics to Discuss

#### {Topic Category 1}
- {Point to discuss}
- {Question to ask}

#### {Topic Category 2}
- {Point to discuss}

#### {Topic Category 3}
- {Point to discuss}

### Open Discussion
- Space for ad-hoc topics

---

## Meeting Notes

{To be filled during/after meeting}

### Summary

{Quick overview of what was discussed}

### Topics Discussed

- **Topic 1**:
- **Topic 2**:
- **Topic 3**:

### Action Items

- [ ] **{Name}** -
- [ ] **{Name}** -
- [ ] **Rich** -

### Key Takeaways

1. **Takeaway 1**:
   -

2. **Takeaway 2**:
   -

---

## Notes for Next Meeting

{Items to remember for next time}
```

## Template Customization

### For Different Meeting Types

**Technical Review Meeting:**
```markdown
## Technical Topics
- Architecture decisions
- Performance issues
- Code reviews

## Project Updates
- Current sprint status
- Blockers
- Timeline adjustments
```

**Performance Review / Feedback:**
```markdown
## Performance Discussion
- Wins and achievements
- Growth areas
- Career development

## Goal Setting
- Q1 objectives
- Success metrics
```

**Project Planning:**
```markdown
## Project Scope
- Requirements
- Timeline
- Resources needed

## Risk Assessment
- Potential blockers
- Dependencies
```

## Best Practices

1. **Reference previous meetings**: Always check the last meeting file to carry forward action items
2. **Be specific with topics**: Instead of "Project update", use "Studio product roadmap discussion"
3. **Categorize topics**: Group related items (Technical, Team, Process, etc.)
4. **Leave space for notes**: Include empty sections that will be filled during the meeting
5. **Include time estimates**: For important topics, note how much time to allocate
6. **Add context**: If a topic needs background, add a brief note in the agenda

## Folder Management

### Create meetings folder if needed

```bash
mkdir -p /Users/rich/osmo/rich/teams/{Team_Member_Name}/meetings
```

### File naming convention

Use consistent naming:
- `1n1-YYYY-MM-DD.md` (preferred)
- `1n1 YYYY-MM-DD.md` (alternative - check what the team member's folder uses)

Check existing files in the folder first to match the format.

## Example Usage

**User**: "Create a template for my meeting with Karen next Tuesday"

**Assistant Actions**:
1. Calculate next Tuesday's date
2. Check `/Users/rich/osmo/rich/teams/Karen_Mak/meetings/` for most recent meeting
3. Read the last meeting file to find action items
4. Ask user what topics they want to discuss
5. Create new file `/Users/rich/osmo/rich/teams/Karen_Mak/meetings/1n1-2026-02-18.md`
6. Populate with follow-up items and agenda topics
7. Ask if they want to update the running `1-1.md` file

## Integration with Other Workflows

### After the Meeting

Once the meeting happens:
1. Fill in the "Meeting Notes" section
2. Update action items with actual decisions
3. If using Granola, you can use `sync-granola-notes` to import transcript and replace template with actual notes

### Linking to Team Files

You can add a reference in the team member's `1-1.md` file:

```markdown
## Upcoming Meeting - February 18, 2026

**Agenda:**
- Follow up on Studio roadmap
- Discuss team resource allocation
- Review Q1 goals

[Full meeting template](meetings/1n1-2026-02-18.md)
```

## Advanced Features

### Multi-Topic Meetings

For complex meetings with many topics, use sections:

```markdown
## Part 1: Team Updates (15 min)
- Topic 1
- Topic 2

## Part 2: Technical Discussion (20 min)
- Topic 3
- Topic 4

## Part 3: Planning (15 min)
- Topic 5
```

### Recurring Meeting Templates

For weekly 1:1s, you can create a reusable section structure that gets copied each time:

```markdown
## Standing Agenda Items
- [ ] Review action items from last week
- [ ] Project status updates
- [ ] Blockers and needs
- [ ] Looking ahead to next week
```

## Error Handling

- If team member folder doesn't exist, ask user to confirm the correct name
- If date is in the past, warn and confirm they want to create it anyway
- If file already exists for that date, ask whether to overwrite or use a different name
- If no previous meeting exists, skip the follow-ups section

## Related Skills

- Use `sync-granola-notes` after the meeting to import actual notes and transcript
- Review previous meetings in the same folder to understand discussion patterns
