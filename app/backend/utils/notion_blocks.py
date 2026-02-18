"""Convert Notion blocks to readable plain text."""


def blocks_to_text(blocks: list, depth: int = 0) -> str:
    """Convert Notion API block objects to readable plain text."""
    lines = []
    indent = "  " * depth

    for block in blocks:
        btype = block.get("type", "")
        data = block.get(btype, {})

        # Extract rich text content
        rich_text = data.get("rich_text", [])
        text = "".join(rt.get("plain_text", "") for rt in rich_text)

        if btype == "paragraph":
            lines.append(f"{indent}{text}")
        elif btype.startswith("heading_"):
            level = btype[-1]
            prefix = "#" * int(level)
            lines.append(f"\n{indent}{prefix} {text}")
        elif btype == "bulleted_list_item":
            lines.append(f"{indent}- {text}")
        elif btype == "numbered_list_item":
            lines.append(f"{indent}1. {text}")
        elif btype == "to_do":
            checked = "[x]" if data.get("checked") else "[ ]"
            lines.append(f"{indent}{checked} {text}")
        elif btype == "toggle":
            lines.append(f"{indent}> {text}")
        elif btype == "code":
            lang = data.get("language", "")
            lines.append(f"{indent}```{lang}\n{indent}{text}\n{indent}```")
        elif btype == "quote":
            lines.append(f"{indent}> {text}")
        elif btype == "callout":
            icon = block.get("callout", {}).get("icon", {}).get("emoji", "")
            lines.append(f"{indent}{icon} {text}")
        elif btype == "divider":
            lines.append(f"{indent}---")
        elif btype == "table_row":
            cells = data.get("cells", [])
            row = " | ".join("".join(rt.get("plain_text", "") for rt in cell) for cell in cells)
            lines.append(f"{indent}| {row} |")
        elif btype == "child_page":
            lines.append(f"{indent}[Page: {data.get('title', '')}]")
        elif btype == "child_database":
            lines.append(f"{indent}[Database: {data.get('title', '')}]")
        elif btype == "bookmark":
            lines.append(f"{indent}[Bookmark: {data.get('url', '')}]")
        elif btype == "image":
            url = data.get("file", data.get("external", {})).get("url", "")
            caption = "".join(rt.get("plain_text", "") for rt in data.get("caption", []))
            lines.append(f"{indent}[Image: {caption or url}]")
        elif text:
            lines.append(f"{indent}{text}")

    return "\n".join(lines)
