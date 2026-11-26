def unread(items):
    return [item for item in items if not item["read"]]
