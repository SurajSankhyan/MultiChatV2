with open('multichat/components/ChatDashboard.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(r"\'delete\'", "'delete'")
code = code.replace(r"\'timeout\'", "'timeout'")
code = code.replace(r"\'ban\'", "'ban'")
code = code.replace(r"\'unban\'", "'unban'")

with open('multichat/components/ChatDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
