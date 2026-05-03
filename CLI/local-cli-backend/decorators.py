import functools
import json
from typing import Any

from fastapi.responses import StreamingResponse


def wrap_sse_stream(func):
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> StreamingResponse:
        generator = await func(*args, **kwargs)

        async def event_formatter():
            async for y in generator:
                yield f"data: {json.dumps(y)}\n\n"

        return StreamingResponse(
            event_formatter(),
            media_type="text/event-stream",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    return wrapper
