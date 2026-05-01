# VideoStreamViewer Plugin
# Live Stream Video Streams Directly to Browser


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from plugins.utils import make_request
from parsers import parse_response

# Create the API router
api_router = APIRouter(prefix="/videostreamviewer", tags=["VideoStreamViewer"])

# API endpoints
@api_router.get("/")
async def video_stream_info():
    """Get UNS plugin information"""
    return {
        "name": "Video Stream Plugin",
        "version": "1.0.0",
        "description": "View all video streams"
    }