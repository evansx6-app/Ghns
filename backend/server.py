from fastapi import FastAPI, APIRouter, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import uuid
from datetime import datetime

# Import our services
from services.stream_metadata import StreamMetadataService
from services.artwork_service import ArtworkService
from services.track_history import TrackHistoryService
from services.lyrics_service import lyrics_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Stream configuration
STREAM_URL = "https://s8.myradiostream.com/58238/listen.mp3"

# Initialize services
metadata_service = StreamMetadataService(STREAM_URL, db)
artwork_service = ArtworkService(db)
track_history_service = TrackHistoryService(db, artwork_service)

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class CurrentTrack(BaseModel):
    title: str
    artist: str
    album: str = None
    isLive: bool = True
    timestamp: str
    artwork_url: str = None

class StreamHealth(BaseModel):
    status: str
    streamUrl: str
    lastChecked: str
    statusCode: int = None
    error: str = None

# Store last track to detect changes
last_track_added = None
last_track_info = None

# Background task to update metadata, artwork, and history
async def update_metadata_task():
    """Background task to update stream metadata, artwork, and track history every 5 seconds"""
    global last_track_added, last_track_info
    
    while True:
        try:
            await metadata_service.update_current_track()
            
            # Get current track and check if it's new
            current_track = await metadata_service.get_current_track()
            if current_track and current_track.get('title') and current_track.get('artist'):
                track_key = f"{current_track['artist']} - {current_track['title']}"
                
                # Only process if this is a new track
                if last_track_info != track_key:
                    logging.info(f"New track detected: {track_key}")
                    
                    # Get artwork for new track
                    artwork_url = await artwork_service.get_artwork_url(
                        current_track['artist'], 
                        current_track['title']
                    )
                    if artwork_url:
                        current_track['artwork_url'] = artwork_url
                        await db.current_track.update_one(
                            {'_id': 'current'},
                            {'$set': {'artwork_url': artwork_url}}
                        )
                    
                    # Add to history
                    if last_track_added != track_key:
                        await track_history_service.add_track_to_history(current_track)
                        last_track_added = track_key
                    
                    last_track_info = track_key
                    
        except Exception as e:
            logging.error(f"Background metadata/artwork/history update failed: {e}")
        await asyncio.sleep(5)  # Update every 5 seconds for faster track change detection

# Background task to cleanup old artwork cache
async def cleanup_cache_task():
    """Background task to cleanup old artwork cache every hour"""
    while True:
        try:
            await artwork_service.cleanup_old_cache()
        except Exception as e:
            logging.error(f"Background cache cleanup failed: {e}")
        await asyncio.sleep(3600)  # 1 hour

# Start background tasks on app startup
@app.on_event("startup")
async def startup_event():
    # Start the background metadata update task
    asyncio.create_task(update_metadata_task())
    asyncio.create_task(cleanup_cache_task())
    logging.info("Started background tasks: metadata updates, track history, and cache cleanup")

# Existing routes
@api_router.get("/")
async def root():
    return {"message": "Greatest Hits Non-Stop Streaming API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Enhanced stream metadata routes
@api_router.get("/current-track", response_model=Dict[str, Any])
async def get_current_track():
    """Get the currently playing track information with artwork"""
    try:
        track = await metadata_service.get_current_track()
        
        # Add artwork if not already present
        if track and not track.get('artwork_url'):
            if track.get('title') and track.get('artist'):
                artwork_url = await artwork_service.get_artwork_url(
                    track['artist'], 
                    track['title']
                )
                if artwork_url:
                    track['artwork_url'] = artwork_url
                else:
                    track['artwork_url'] = await artwork_service.get_fallback_artwork_url()
            else:
                track['artwork_url'] = await artwork_service.get_fallback_artwork_url()
        
        return track
    except Exception as e:
        logging.error(f"Error getting current track: {e}")
        fallback_track = metadata_service._get_fallback_track()
        fallback_track['artwork_url'] = await artwork_service.get_fallback_artwork_url()
        return fallback_track

@api_router.get("/stream/health", response_model=Dict[str, Any])
async def get_stream_health():
    """Check stream health and accessibility"""
    try:
        health = await metadata_service.check_stream_health()
        return health
    except Exception as e:
        logging.error(f"Error checking stream health: {e}")
        return {
            'status': 'error',
            'error': str(e),
            'streamUrl': STREAM_URL,
            'lastChecked': datetime.utcnow().isoformat()
        }

@api_router.post("/refresh-metadata")
async def refresh_metadata():
    """Manually refresh current track metadata and artwork"""
    try:
        await metadata_service.update_current_track()
        track = await metadata_service.get_current_track()
        
        # Fetch fresh artwork
        if track and track.get('title') and track.get('artist'):
            artwork_url = await artwork_service.get_artwork_url(
                track['artist'], 
                track['title']
            )
            if artwork_url:
                track['artwork_url'] = artwork_url
                # Update in database
                await db.current_track.update_one(
                    {'_id': 'current'},
                    {'$set': {'artwork_url': artwork_url}}
                )
        
        return {
            "success": True,
            "message": "Metadata and artwork refreshed successfully",
            "track": track
        }
    except Exception as e:
        logging.error(f"Error refreshing metadata: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@api_router.get("/artwork/{artist}/{title}")
async def get_track_artwork(artist: str, title: str):
    """Get artwork URL for a specific track"""
    try:
        artwork_url = await artwork_service.get_artwork_url(artist, title)
        if artwork_url:
            return {"artwork_url": artwork_url}
        else:
            fallback_url = await artwork_service.get_fallback_artwork_url()
            return {"artwork_url": fallback_url, "fallback": True}
    except Exception as e:
        logging.error(f"Error getting artwork for {artist} - {title}: {e}")
        fallback_url = await artwork_service.get_fallback_artwork_url()
        return {"artwork_url": fallback_url, "fallback": True, "error": str(e)}

# NEW: Track history routes
@api_router.get("/recent-tracks")
async def get_recent_tracks(limit: int = 20):
    """Get recently played tracks"""
    try:
        tracks = await track_history_service.get_recent_tracks(limit)
        return {
            "success": True,
            "tracks": tracks,
            "count": len(tracks)
        }
    except Exception as e:
        logging.error(f"Error getting recent tracks: {e}")
        return {
            "success": False,
            "error": str(e),
            "tracks": []
        }

@api_router.get("/todays-tracks")
async def get_todays_tracks():
    """Get today's tracks grouped by hour"""
    try:
        tracks = await track_history_service.get_todays_tracks()
        return {
            "success": True,
            "tracks": tracks
        }
    except Exception as e:
        logging.error(f"Error getting today's tracks: {e}")
        return {
            "success": False,
            "error": str(e),
            "tracks": {}
        }

@api_router.delete("/track-history")
async def clear_track_history():
    """Clear all track history"""
    try:
        deleted_count = await track_history_service.clear_history()
        return {
            "success": True,
            "message": f"Cleared {deleted_count} track history entries"
        }
    except Exception as e:
        logging.error(f"Error clearing track history: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@api_router.post("/cleanup-fallback-tracks")
async def cleanup_fallback_tracks():
    """Remove fallback/placeholder tracks from recent tracks history"""
    try:
        removed_count = await track_history_service.cleanup_fallback_tracks()
        return {
            "success": True,
            "message": f"Removed {removed_count} fallback tracks from history",
            "removed_count": removed_count
        }
    except Exception as e:
        logging.error(f"Error cleaning up fallback tracks: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@api_router.get("/lyrics/{artist}/{title}")
async def get_lyrics(artist: str, title: str):
    """Get lyrics for a specific track"""
    try:
        result = await lyrics_service.fetch_lyrics(artist, title)
        return {
            "success": True,
            "artist": artist,
            "title": title,
            **result
        }
    except Exception as e:
        logging.error(f"Error fetching lyrics for {artist} - {title}: {e}")
        return {
            "success": False,
            "error": "Failed to fetch lyrics",
            "artist": artist,
            "title": title
        }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()