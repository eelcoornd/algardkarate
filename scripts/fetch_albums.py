import requests
import json
import os

CLIENT_ID = os.environ['GOOGLE_CLIENT_ID']
CLIENT_SECRET = os.environ['GOOGLE_CLIENT_SECRET']
REFRESH_TOKEN = os.environ['GOOGLE_REFRESH_TOKEN']

ALBUM_IDS = [
    "AF1QipMHSaLqL64KEIRj0MwkFahhYFagmiHOYw4Pwzw",
    "AF1QipP71SEGwa9UF97tIuh0wMW_meKusfZDqLoS-yk",
    "AF1QipNICXg29oovgCVCSJ-INPPylV6vRlxgfFabTcU",
    "AF1QipNdTRm2B9gEX3uBE53lOVg3S4HtVZgCe5wkD74",
    "AF1QipMcnO2bwi_PchducwGB6YuAC-UWW6J2hpEQm24",
    "AF1QipNYy31ucA_dVgWAmvm__GfDhcx7Ub5NGuWGs6Q",
    "AF1QipPGyoDrFPFFRmmOGu-GqBmRQ3DuZV2GZOnmydw",
    "AF1QipOq1d9xChLX0RpL4GuEpxE0qRSDkWXJzDv0LJM",
    "AF1QipPu7jPd7IumoAungESXffu--5dHckQoXfHSQDc",
    "AF1QipOkXJQo7Vtmkp7DqAV7Js7Pa0AeXYypCRVKvJU",
    "AF1QipOEgFtmldR-humQvZZMws_NurJCDefMWv_pnRc",
    "AF1QipOkrx68MzMArOBjRUQhhMw5ke4dn4GpSKXq3nw",
    "AF1QipPbG6wxzuGhMQJx6ggcceNvWbPVaz9VPAT_nEM",
    "AF1QipNlZTWieeX9nBYAycozhErJrw9q5rkNNdn1Lq4",
    "AF1QipMcN4K9ilypPlPuZGEJlXdAEOmRf54k2LKcS2Q",
    "AF1QipNMAKBX4oVCU40Me9JKQ2DfzYsB3gCwTh4sVRE",
    "AF1QipN2G6Ux1BQ7fS4ympeon7W3L6QnlJc92RTPNng",
    "AF1QipPRFedBMD_noqmAo96wjwqJ9zydTl-I8BHsztQ",
    "AF1QipOF11STTuLsHIjlFNQhD68-Fj5au0c4Z635wBM",
    "AF1QipOpuLsm5qQmOolgf9oVw8OKMXwn2CIBn78YyY8",
    "AF1QipOmXfrM3q_TLItrea7iv2_Atmxi0INQdRAxhDA",
]

SHARED_TOKENS = [
    "AF1QipMU6Xz9mDXKwE4f935tFujGb-ivVVeRr6VIXJO9C7fxU3dDUcJXqxdvY_bLMOoAQQ",
    "AF1QipOK-KSc5hfjSCGxvQ9DeaeVQqcflwo2Bf3OvZwiI2dMhnja1OYKaZ5nGXMvRdHbSw",
]

def get_access_token():
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token"
    })
    return r.json()["access_token"]

def fetch_album(token, album_id):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"https://photoslibrary.googleapis.com/v1/albums/{album_id}",
        headers=headers
    )
    data = r.json()
    if "error" in data:
        print(f"⚠️  Feil for {album_id}: {data['error']['message']}")
        return None
    return {
        "id": album_id,
        "title": data.get("title", "Uten tittel"),
        "url": data.get("productUrl", ""),
        "cover": data.get("coverPhotoBaseUrl", "") + "=w600-h400-c",
        "count": data.get("mediaItemsCount", 0)
    }

def fetch_shared_album(token, share_token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(
        "https://photoslibrary.googleapis.com/v1/sharedAlbums:join",
        headers=headers,
        json={"shareToken": share_token}
    )
    data = r.json()
    album = data.get("album", {})
    if not album:
        print(f"⚠️  Feil for shared {share_token[:20]}...: {data}")
        return None
    return {
        "id": share_token,
        "title": album.get("title", "Delt album"),
        "url": album.get("productUrl", ""),
        "cover": album.get("coverPhotoBaseUrl", "") + "=w600-h400-c",
        "count": album.get("mediaItemsCount", 0)
    }

os.makedirs("data", exist_ok=True)

token = get_access_token()
albums = []

for aid in ALBUM_IDS:
    result = fetch_album(token, aid)
    if result:
        albums.append(result)
        print(f"✅ {result['title']}")

for st in SHARED_TOKENS:
    result = fetch_shared_album(token, st)
    if result:
        albums.append(result)
        print(f"✅ {result['title']} (delt)")

with open("data/albums.json", "w") as f:
    json.dump({"albums": albums}, f, indent=2, ensure_ascii=False)

print(f"\n🎉 Hentet {len(albums)} album → data/albums.json")
