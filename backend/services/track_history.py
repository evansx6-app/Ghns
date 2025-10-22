import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from services.artwork_service import ArtworkService

logger = logging.getLogger(__name__)

class TrackHistoryService:
    def __init__(self, db, artwork_service: ArtworkService):
        self.db = db
        self.artwork_service = artwork_service
        self.max_history_entries = 50  # Keep last 50 tracks
        
    def _is_fallback_track(self, track: Dict[str, Any]) -> bool:
        """Check if this is a fallback/placeholder track that shouldn't be in history"""
        if not track or not track.get('title') or not track.get('artist'):
            return True
            
        title = track.get('title', '').strip().lower()
        artist = track.get('artist', '').strip().lower()
        
        # Common fallback patterns to exclude from recent tracks
        fallback_patterns = [
            'legendary radio from scotland',
            'greatest hits non-stop',
            'live radio from scotland',
            'radio stream',
            'now playing',
            'station identifier',
            'commercial break',
            'advertisement'
        ]
        
        # Check if title or artist contains fallback patterns
        for pattern in fallback_patterns:
            if pattern in title or pattern in artist:
                return True
        
        # Check if artist is just the station name
        if artist in ['greatest hits non-stop', 'live radio from scotland', 'radio station']:
            return True
            
        # Check for very short titles (likely not real songs)
        if len(title.strip()) < 2 or len(artist.strip()) < 2:
            return True
            
        return False

    async def add_track_to_history(self, track: Dict[str, Any]) -> None:
        """Add a track to the play history (excludes fallback/placeholder tracks)"""
        try:
            if not track or not track.get('title') or not track.get('artist'):
                return
            
            # Skip fallback tracks
            if self._is_fallback_track(track):
                logger.debug(f"Skipping fallback track: {track.get('title')} - {track.get('artist')}")
                return
                
            # Create history entry
            history_entry = {
                'title': track['title'],
                'artist': track['artist'],
                'album': track.get('album'),
                'played_at': datetime.now(timezone.utc),
                'artwork_url': track.get('artwork_url')
            }
            
            # Check if this is a duplicate (same song within 5 minutes)
            recent_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
            recent_same_track = await self.db.track_history.find_one({
                'title': track['title'],
                'artist': track['artist'],
                'played_at': {'$gte': recent_cutoff}
            })
            
            if recent_same_track:
                logger.info(f"Skipping duplicate track entry: {track['title']} - {track['artist']}")
                return
            
            # Insert the new track
            await self.db.track_history.insert_one(history_entry)
            logger.info(f"Added track to history: {track['title']} - {track['artist']}")
            
            # Clean up old entries (keep only last 50)
            await self._cleanup_old_history()
            
        except Exception as e:
            logger.error(f"Error adding track to history: {e}")
    
    async def get_recent_tracks(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently played tracks (excludes fallback/placeholder tracks)"""
        try:
            # Fetch more tracks than needed to account for filtering
            fetch_limit = limit * 2  # Fetch double to ensure we get enough real tracks
            cursor = self.db.track_history.find().sort('played_at', -1).limit(fetch_limit)
            tracks = await cursor.to_list(length=fetch_limit)
            
            # Format and filter the tracks for display
            formatted_tracks = []
            for track in tracks:
                # Skip fallback tracks
                if self._is_fallback_track(track):
                    continue
                formatted_track = {
                    'title': track['title'],
                    'artist': track['artist'],
                    'album': track.get('album'),
                    'played_at': track['played_at'],
                    'played_at_formatted': self._format_play_time(track['played_at']),
                    'artwork_url': track.get('artwork_url')
                }
                
                # Get artwork if not available or ensure HTTPS
                artwork_url = formatted_track['artwork_url']
                if not artwork_url:
                    artwork_url = await self.artwork_service.get_artwork_url(
                        track['artist'], 
                        track['title']
                    )
                    if artwork_url:
                        formatted_track['artwork_url'] = artwork_url
                        # Update the database with the artwork
                        await self.db.track_history.update_one(
                            {'_id': track['_id']},
                            {'$set': {'artwork_url': artwork_url}}
                        )
                    else:
                        formatted_track['artwork_url'] = await self.artwork_service.get_fallback_artwork_url()
                elif artwork_url.startswith('http://'):
                    # Convert HTTP to HTTPS for existing cached URLs
                    https_url = artwork_url.replace('http://', 'https://')
                    formatted_track['artwork_url'] = https_url
                    # Update the database with HTTPS URL
                    await self.db.track_history.update_one(
                        {'_id': track['_id']},
                        {'$set': {'artwork_url': https_url}}
                    )
                
                formatted_tracks.append(formatted_track)
                
                # Stop when we have enough real tracks
                if len(formatted_tracks) >= limit:
                    break
            
            return formatted_tracks
            
        except Exception as e:
            logger.error(f"Error getting recent tracks: {e}")
            return []
    
    async def cleanup_fallback_tracks(self) -> int:
        """Remove existing fallback tracks from history"""
        try:
            # Get all tracks to check them
            all_tracks = await self.db.track_history.find().to_list(None)
            removed_count = 0
            
            for track in all_tracks:
                if self._is_fallback_track(track):
                    await self.db.track_history.delete_one({'_id': track['_id']})
                    removed_count += 1
                    logger.debug(f"Removed fallback track: {track.get('title')} - {track.get('artist')}")
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} fallback tracks from history")
            
            return removed_count
            
        except Exception as e:
            logger.error(f"Error cleaning up fallback tracks: {e}")
            return 0
    
    async def get_todays_tracks(self) -> List[Dict[str, Any]]:
        """Get tracks played today, grouped by hour"""
        try:
            # Get start of today
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            
            cursor = self.db.track_history.find({
                'played_at': {'$gte': today_start}
            }).sort('played_at', -1)
            
            tracks = await cursor.to_list(length=None)
            
            # Group by hour
            hourly_tracks = {}
            for track in tracks:
                hour_key = track['played_at'].strftime('%H:00')
                if hour_key not in hourly_tracks:
                    hourly_tracks[hour_key] = []
                
                formatted_track = {
                    'title': track['title'],
                    'artist': track['artist'],
                    'album': track.get('album'),
                    'played_at': track['played_at'],
                    'played_at_formatted': track['played_at'].strftime('%I:%M%p').lower(),
                    'artwork_url': track.get('artwork_url') or await self.artwork_service.get_fallback_artwork_url()
                }
                hourly_tracks[hour_key].append(formatted_track)
            
            return hourly_tracks
            
        except Exception as e:
            logger.error(f"Error getting today's tracks: {e}")
            return {}
    
    def _format_play_time(self, played_at: datetime) -> str:
        """Format play time for display"""
        now = datetime.now(timezone.utc)
        # Ensure played_at is timezone-aware
        if played_at.tzinfo is None:
            played_at = played_at.replace(tzinfo=timezone.utc)
        diff = now - played_at
        
        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
        elif diff.seconds > 3600:  # More than 1 hour
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        elif diff.seconds > 60:  # More than 1 minute
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        else:
            return "Just now"
    
    async def _cleanup_old_history(self):
        """Remove old history entries beyond the limit"""
        try:
            # Count total entries
            total_count = await self.db.track_history.count_documents({})
            
            if total_count > self.max_history_entries:
                # Find the cutoff date for the oldest entries to keep
                cursor = self.db.track_history.find().sort('played_at', -1).limit(self.max_history_entries)
                tracks_to_keep = await cursor.to_list(length=self.max_history_entries)
                
                if tracks_to_keep:
                    cutoff_date = tracks_to_keep[-1]['played_at']
                    
                    # Delete older entries
                    result = await self.db.track_history.delete_many({
                        'played_at': {'$lt': cutoff_date}
                    })
                    
                    if result.deleted_count > 0:
                        logger.info(f"Cleaned up {result.deleted_count} old history entries")
                        
        except Exception as e:
            logger.error(f"Error cleaning up old history: {e}")
    
    async def clear_history(self):
        """Clear all track history"""
        try:
            result = await self.db.track_history.delete_many({})
            logger.info(f"Cleared {result.deleted_count} history entries")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error clearing history: {e}")
            return 0