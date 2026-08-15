import requests, os

token = os.environ.get('GITHUB_TOKEN') or os.popen('gh auth token').read().strip()
headers = {'Authorization': f'Bearer {token}', 'Accept': 'vnd.github+json'}
r = requests.get('https://api.github.com/repos/jasonycw/carcassonne/pulls/2/comments', headers=headers)
for c in r.json():
    print(f"Path: {c.get('path')}, Line: {c.get('line')}")
    print(c.get('body'))
    print('-'*40)
