import requests, os

token = os.environ.get('GITHUB_TOKEN') or os.popen('gh auth token').read().strip()
headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'}
r = requests.get('https://api.github.com/repos/jasonycw/carcassonne/issues/2/comments', headers=headers)
for c in r.json():
    print(f"Author: {c.get('user', {}).get('login')}")
    print(c.get('body'))
    print('='*50)

r2 = requests.get('https://api.github.com/repos/jasonycw/carcassonne/pulls/2/reviews', headers=headers)
for rev in r2.json():
    print(f"Reviewer: {rev.get('user', {}).get('login')} - State: {rev.get('state')}")
    print(rev.get('body'))
    print('='*50)
