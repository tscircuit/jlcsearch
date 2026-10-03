import re
content = open('tests/build-derived-sync-db.test.ts').read()
# Replace `last_on_stock,\n` with `last_on_stock, is_extended_promotional,\n`
content = content.replace("last_on_stock,\n          description", "last_on_stock, is_extended_promotional,\n          description")
content = content.replace("last_on_stock,\n        description", "last_on_stock, is_extended_promotional,\n        description")

# Add a 0 value for is_extended_promotional
content = content.replace("unixepoch(), 'HDMI Female", "unixepoch(), 0, 'HDMI Female")
content = content.replace("unixepoch(),\n          '64 Bit", "unixepoch(), 0,\n          '64 Bit")
content = content.replace("unixepoch(), 'No longer", "unixepoch(), 0, 'No longer")

open('tests/build-derived-sync-db.test.ts', 'w').write(content)
