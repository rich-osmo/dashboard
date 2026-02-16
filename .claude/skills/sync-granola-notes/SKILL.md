---
name: sync-granola-notes
description: This skill should be used when the user asks to "sync granola notes", "import meeting notes", "update 1:1 from granola", "pull in latest meeting notes", or wants to create meeting notes from Granola recordings. Use this to sync meeting transcripts and notes from Granola into team 1:1 meeting files.
version: 1.0.0
---

# Sync Granola Notes to 1:1s

This skill helps you sync meeting notes from Granola into your team 1:1 meeting files. It will search for recent meetings, retrieve their details and transcripts, and create properly formatted markdown files in your teams folder structure.

## Overview

This skill integrates with Granola (meeting recording and transcription tool) to automatically pull meeting notes into your team's 1:1 documentation structure. It handles:
- Searching for recent meetings by participant name or date
- Retrieving full meeting details, transcripts, and documents
- Creating properly formatted meeting files in the teams folder structure
- Organizing meetings by date and participant

## When This Skill Applies

Use this skill when you want to:
- Sync recent Granola meeting notes into your 1:1 files
- Create a new meeting file from a Granola recording
- Import multiple meetings at once
- Update an existing meeting file with Granola content

## How It Works

### Step 1: Search for Meetings

First, load the Granola tools and search for relevant meetings:

```
Ask the user which team member's meetings they want to sync, or search for meetings by:
- Participant name (e.g., "Wesley Qian", "Karen Mak")
- Date range (e.g., "meetings from last week")
- Meeting title keywords
```

Use the `mcp__granola__search_meetings` tool to find meetings.

### Step 2: Get Meeting Details

For each meeting found, retrieve the full details:
- Meeting metadata (date, participants, title)
- Summary and key points
- Action items
- Full transcript

Use `mcp__granola__get_meeting_details` and `mcp__granola__get_meeting_transcript` tools.

### Step 3: Create Meeting Files

Create or update meeting files in the appropriate team member's folder:

```
/Users/rich/osmo/rich/teams/{Team_Member_Name}/meetings/1n1-YYYY-MM-DD.md
```

### Meeting File Format

Use this template structure:

```markdown
# 1:1 Meeting: {Participant_Short_Name} / Rich

**Date:** {Month Day, Year, Time}
**Participants:** {Full Names}
**Granola Link:** [View Meeting]({granola_url})

## Summary

{High-level summary of what was discussed}

### Topics Discussed

- **Topic 1**: Brief description
- **Topic 2**: Brief description
- **Topic 3**: Brief description

### Action Items

- [ ] **Person** - Action item description
- [ ] **Person** - Action item description

### Key Takeaways

1. **Key Point 1**:
   - Supporting detail
   - Supporting detail

2. **Key Point 2**:
   - Supporting detail

## Full Meeting Notes

{Detailed notes or transcript from the meeting}

---

## Technical Context

{Any additional technical or contextual information}
```

### Step 4: Handle Multiple Meetings

If syncing multiple meetings:
1. Ask the user which meetings to import (show list with dates and participants)
2. Create files for each selected meeting
3. Ensure proper file naming and folder structure
4. Report summary of what was created

## Best Practices

1. **Always confirm before creating files**: Show the user what meetings were found and which files will be created
2. **Check for existing files**: If a meeting file already exists for that date, ask whether to overwrite or merge
3. **Use proper file naming**: Use format `1n1-YYYY-MM-DD.md` (note: sometimes files use spaces like `1n1 YYYY-MM-DD.md` - check existing format in the team member's folder)
4. **Preserve formatting**: Keep the structured format consistent with existing meeting notes
5. **Extract action items**: Parse action items from Granola and format them as checkboxes
6. **Link to Granola**: Always include the Granola meeting link for reference

## Folder Structure

Your teams folder is organized as:

```
/Users/rich/osmo/rich/teams/
├── Team_Member_Name/
│   ├── 1-1.md           # Current running notes
│   ├── role.md          # Role description
│   ├── feedback.md      # Feedback notes
│   └── meetings/        # Historical meeting notes
│       ├── 1n1-2025-04-24.md
│       ├── 1n1-2025-06-06.md
│       └── ...
```

Create the `meetings/` folder if it doesn't exist.

## Example Usage

**User**: "Sync my latest meetings with Wesley from Granola"

**Assistant Actions**:
1. Load Granola tools using ToolSearch
2. Search for meetings with Wesley Qian
3. Show user the list of meetings found
4. Ask which ones to import
5. Retrieve full details for selected meetings
6. Create formatted markdown files in `/Users/rich/osmo/rich/teams/Wesley_Qian/meetings/`
7. Report what was created

## Error Handling

- If team member folder doesn't exist, ask user to confirm the correct name
- If Granola tools aren't available, inform user to set up Granola MCP server
- If no meetings found, suggest broader search criteria
- If meeting already exists, ask whether to overwrite or skip

## Related Skills

- Use `create-meeting-template` to create a template for an upcoming meeting
- After syncing, you can update the team member's `1-1.md` file with recent discussion points
