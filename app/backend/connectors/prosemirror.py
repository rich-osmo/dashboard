"""Convert ProseMirror JSON (from Granola documentPanels) to plain text and HTML."""


def pm_to_text(node: dict | list | None) -> str:
    if node is None:
        return ""
    if isinstance(node, list):
        return "".join(pm_to_text(n) for n in node)
    if not isinstance(node, dict):
        return ""

    ntype = node.get("type", "")

    if ntype == "text":
        return node.get("text", "")

    children = node.get("content", [])
    inner = "".join(pm_to_text(c) for c in children) if children else ""

    if ntype == "doc":
        return inner
    if ntype == "paragraph":
        return inner + "\n"
    if ntype == "heading":
        level = node.get("attrs", {}).get("level", 1)
        return "\n" + "#" * level + " " + inner + "\n"
    if ntype == "bulletList":
        return inner
    if ntype == "orderedList":
        return inner
    if ntype == "listItem":
        # Get text of child paragraphs, indent as bullet
        lines = inner.strip().split("\n")
        result = ""
        for i, line in enumerate(lines):
            if i == 0:
                result += "- " + line + "\n"
            elif line.strip():
                result += "  " + line + "\n"
        return result
    if ntype == "blockquote":
        lines = inner.strip().split("\n")
        return "\n".join("> " + line for line in lines) + "\n"
    if ntype == "codeBlock":
        return "\n```\n" + inner + "\n```\n"
    if ntype == "hardBreak":
        return "\n"
    if ntype == "horizontalRule":
        return "\n---\n"
    if ntype == "taskList":
        return inner
    if ntype == "taskItem":
        checked = node.get("attrs", {}).get("checked", False)
        mark = "x" if checked else " "
        lines = inner.strip().split("\n")
        result = f"- [{mark}] " + (lines[0] if lines else "") + "\n"
        for line in lines[1:]:
            if line.strip():
                result += "  " + line + "\n"
        return result

    return inner


def pm_to_html(node: dict | list | None) -> str:
    if node is None:
        return ""
    if isinstance(node, list):
        return "".join(pm_to_html(n) for n in node)
    if not isinstance(node, dict):
        return ""

    ntype = node.get("type", "")

    if ntype == "text":
        text = node.get("text", "")
        marks = node.get("marks", [])
        for mark in marks:
            mt = mark.get("type", "")
            if mt == "bold":
                text = f"<strong>{text}</strong>"
            elif mt == "italic":
                text = f"<em>{text}</em>"
            elif mt == "code":
                text = f"<code>{text}</code>"
            elif mt == "link":
                href = mark.get("attrs", {}).get("href", "")
                text = f'<a href="{href}">{text}</a>'
        return text

    children = node.get("content", [])
    inner = "".join(pm_to_html(c) for c in children) if children else ""

    if ntype == "doc":
        return inner
    if ntype == "paragraph":
        return f"<p>{inner}</p>"
    if ntype == "heading":
        level = node.get("attrs", {}).get("level", 1)
        return f"<h{level}>{inner}</h{level}>"
    if ntype == "bulletList":
        return f"<ul>{inner}</ul>"
    if ntype == "orderedList":
        return f"<ol>{inner}</ol>"
    if ntype == "listItem":
        return f"<li>{inner}</li>"
    if ntype == "blockquote":
        return f"<blockquote>{inner}</blockquote>"
    if ntype == "codeBlock":
        return f"<pre><code>{inner}</code></pre>"
    if ntype == "hardBreak":
        return "<br>"
    if ntype == "horizontalRule":
        return "<hr>"
    if ntype == "taskList":
        return f"<ul>{inner}</ul>"
    if ntype == "taskItem":
        checked = node.get("attrs", {}).get("checked", False)
        check_attr = " checked" if checked else ""
        return f'<li><input type="checkbox"{check_attr} disabled> {inner}</li>'

    return inner
