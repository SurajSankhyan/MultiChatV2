import re

with open('multichat/components/ChatDashboard.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

channel_id_inject = "\n              channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,"
channel_id_inject_2 = "\n            channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,"

code = re.sub(r'userId:\s*user\?\.id,\s*userEmail:\s*user\?\.email,\s*action:\s*\'delete\',', 
              r'userId: user?.id, userEmail: user?.email,' + channel_id_inject + r'\n              action: \'delete\',', code)

code = re.sub(r'userId:\s*user\?\.id\s*\|\|\s*\'default-user\',\s*userEmail:\s*targetEmail,\s*action:\s*\'timeout\',', 
              r'userId: user?.id, userEmail: user?.email || targetEmail,' + channel_id_inject_2 + r'\n            action: \'timeout\',', code)

code = re.sub(r'userId:\s*user\?\.id\s*\|\|\s*\'default-user\',\s*userEmail:\s*targetEmail,\s*action:\s*\'ban\',', 
              r'userId: user?.id, userEmail: user?.email || targetEmail,' + channel_id_inject_2 + r'\n            action: \'ban\',', code)

code = re.sub(r'userId:\s*user\?\.id,\s*userEmail:\s*user\?\.email,\s*action:\s*\'unban\',', 
              r'userId: user?.id, userEmail: user?.email,' + channel_id_inject + r'\n              action: \'unban\',', code)

code = re.sub(r'userId:\s*user\?\.id\s*\|\|\s*\'default-user\',\s*userEmail:\s*targetEmail,\s*action:\s*action,', 
              r'userId: user?.id, userEmail: user?.email || targetEmail,' + channel_id_inject_2 + r'\n            action: action,', code)

with open('multichat/components/ChatDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Payloads patched with regex')
