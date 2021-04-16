import asyncio
import aiohttp
from aiohttp import ClientSession, ClientConnectorError
import time

fn = "urllist.txt"
with open(fn) as f:
    urls = [line.rstrip('\n') for line in f]

test = urls[1:50]

async def fetch_json(url, session):
    try:
        res = await session.get(url)
    except Exception as e:
        print(e)
        return 404
    return res

async def make_requests(urls):
    async with ClientSession() as session:
        tasks = []
        for url in urls:
            tasks.append(
                fetch_json(url, session)
            )
        results = await asyncio.gather(*tasks)
    
    return results

if __name__ == "__main__":
t0 = time.time()
out = asyncio.run(make_requests(test))
t1 = time.time()
print("Took {0} ms".format(t1 - t0))
