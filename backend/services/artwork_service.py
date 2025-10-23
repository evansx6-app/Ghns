import requests
import asyncio
import logging
from typing import Optional, Dict, Any
from urllib.parse import quote
import hashlib
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

class ArtworkService:
    def __init__(self, db):
        self.db = db
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'GreatestHitsNonStop/1.0 (streaming-app@example.com)'
        })
        
        # Cache artwork for 24 hours
        self.cache_duration = timedelta(hours=24)
    
    def _generate_cache_key(self, artist: str, title: str) -> str:
        """Generate a cache key for artist/title combination"""
        combined = f"{artist.lower().strip()}|{title.lower().strip()}"
        return hashlib.md5(combined.encode('utf-8')).hexdigest()
    
    async def get_artwork_url(self, artist: str, title: str) -> Optional[str]:
        """Get artwork URL for a track, with caching"""
        try:
            cache_key = self._generate_cache_key(artist, title)
            
            # Check cache first
            cached_artwork = await self.db.artwork_cache.find_one({'_id': cache_key})
            
            if cached_artwork:
                # Check if cache is still valid
                cached_time = cached_artwork.get('cached_at')
                if cached_time and isinstance(cached_time, datetime):
                    # Ensure cached_time is timezone-aware
                    if cached_time.tzinfo is None:
                        cached_time = cached_time.replace(tzinfo=timezone.utc)
                    
                    if datetime.now(timezone.utc) - cached_time < self.cache_duration:
                        return cached_artwork.get('artwork_url')
            
            # Fetch new artwork with overall timeout of 15 seconds
            artwork_url = await asyncio.wait_for(
                self._fetch_artwork_from_musicbrainz(artist, title),
                timeout=15.0
            )
            
            # Cache the result (even if None, to avoid repeated failed requests)
            await self.db.artwork_cache.replace_one(
                {'_id': cache_key},
                {
                    '_id': cache_key,
                    'artist': artist,
                    'title': title,
                    'artwork_url': artwork_url,
                    'cached_at': datetime.now(timezone.utc)
                },
                upsert=True
            )
            
            return artwork_url
            
        except Exception as e:
            logger.error(f"Error getting artwork for {artist} - {title}: {e}")
            return None
    
    async def _fetch_artwork_from_musicbrainz(self, artist: str, title: str) -> Optional[str]:
        """Fetch artwork URL from MusicBrainz and Cover Art Archive"""
        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            artwork_url = await loop.run_in_executor(
                None, 
                self._search_musicbrainz_sync, 
                artist, 
                title
            )
            
            # If MusicBrainz fails, try alternative sources
            if not artwork_url:
                artwork_url = await self._fetch_from_alternative_sources(artist, title)
            
            return artwork_url
        except Exception as e:
            logger.error(f"Error fetching artwork from MusicBrainz: {e}")
            return None
    
    async def _fetch_from_alternative_sources(self, artist: str, title: str) -> Optional[str]:
        """Try alternative artwork sources when MusicBrainz fails"""
        try:
            # Return vinyl fallback placeholder marker for frontend to handle
            return "vinyl-fallback-placeholder"
            
        except Exception as e:
            logger.error(f"Error with alternative sources: {e}")
            return "vinyl-fallback-placeholder"
    
    def _search_musicbrainz_sync(self, artist: str, title: str) -> Optional[str]:
        """Synchronous MusicBrainz search"""
        try:
            # Clean up artist and title for search
            clean_artist = self._clean_search_term(artist)
            clean_title = self._clean_search_term(title)
            
            # Handle complex artist names - use just the primary artist
            primary_artist = self._extract_primary_artist(clean_artist)
            
            # Try multiple search strategies
            search_strategies = [
                # Strategy 1: Exact match with primary artist
                f'recording:"{clean_title}" AND artist:"{primary_artist}"',
                # Strategy 2: Broader search with full artist name
                f'recording:"{clean_title}" AND artist:"{clean_artist}"',
                # Strategy 3: Fuzzy search - just title and primary artist name
                f'"{clean_title}" AND "{primary_artist}"',
                # Strategy 4: Title-only search (as last resort)
                f'recording:"{clean_title}"'
            ]
            
            mb_url = f"https://musicbrainz.org/ws/2/recording/"
            
            for strategy_index, search_query in enumerate(search_strategies):
                try:
                    params = {
                        'query': search_query,
                        'limit': 5,
                        'inc': 'releases',
                        'fmt': 'json'
                    }
                    
                    logger.info(f"MusicBrainz search strategy {strategy_index + 1} for '{artist}' - '{title}': {search_query}")
                    
                    response = self.session.get(mb_url, params=params, timeout=10)
                    response.raise_for_status()
                    
                    data = response.json()
                    recordings = data.get('recordings', [])
                    
                    if recordings:
                        logger.info(f"Found {len(recordings)} recordings with strategy {strategy_index + 1}")
                        
                        # Try to find artwork from releases
                        for recording in recordings:
                            releases = recording.get('releases', [])
                            for release in releases:
                                release_id = release.get('id')
                                if release_id:
                                    artwork_url = self._get_cover_art_archive_url(release_id)
                                    if artwork_url:
                                        logger.info(f"Found artwork for {artist} - {title} using strategy {strategy_index + 1}: {artwork_url}")
                                        return artwork_url
                    
                    # Wait between attempts to respect rate limits
                    import time
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.debug(f"Strategy {strategy_index + 1} failed: {e}")
                    continue
            
            logger.info(f"No artwork found for {artist} - {title} after trying all strategies")
            return None
            
        except Exception as e:
            logger.error(f"Error searching MusicBrainz for {artist} - {title}: {e}")
            return None
    
    def _get_cover_art_archive_url(self, release_id: str) -> Optional[str]:
        """Get cover art URL from Cover Art Archive"""
        try:
            caa_url = f"https://coverartarchive.org/release/{release_id}"
            response = self.session.get(caa_url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                images = data.get('images', [])
                
                # Look for front cover first
                for image in images:
                    if 'Front' in image.get('types', []):
                        image_url = image.get('image')
                        # Ensure HTTPS for mixed content security
                        if image_url and image_url.startswith('http://'):
                            image_url = image_url.replace('http://', 'https://')
                        return image_url
                
                # If no front cover, use first available image
                if images:
                    image_url = images[0].get('image')
                    # Ensure HTTPS for mixed content security
                    if image_url and image_url.startswith('http://'):
                        image_url = image_url.replace('http://', 'https://')
                    return image_url
            
            return None
            
        except Exception as e:
            logger.debug(f"No cover art found for release {release_id}: {e}")
            return None
    
    def _clean_search_term(self, term: str) -> str:
        """Clean search term for better MusicBrainz matching"""
        if not term:
            return ""
        
        # Convert to lowercase for processing
        term = term.lower()
        
        # Remove remaster/reissue information
        remaster_patterns = [
            r'- \d{4} remaster.*$',
            r'- remaster.*$', 
            r'- \d{4} reissue.*$',
            r'- reissue.*$',
            r'- \d{4} version.*$',
            r'- version.*$',
            r'- \d{4} mix.*$',
            r'- mix.*$',
            r'- remix.*$',
            r'- radio edit.*$',
            r'- single version.*$',
            r'- album version.*$'
        ]
        
        import re
        for pattern in remaster_patterns:
            term = re.sub(pattern, '', term, flags=re.IGNORECASE)
        
        # Remove featuring/collaboration info
        collab_patterns = [
            r'\(feat\..*?\)',
            r'\(ft\..*?\)', 
            r'\(featuring.*?\)',
            r'feat\..*',
            r'ft\..*',
            r'featuring.*'
        ]
        
        for pattern in collab_patterns:
            term = re.sub(pattern, '', term, flags=re.IGNORECASE)
        
        # Remove brackets and parentheses content that might interfere
        term = re.sub(r'\[.*?\]', '', term)
        term = re.sub(r'\(.*?\)', '', term)
        
        # Remove extra whitespace and normalize
        term = ' '.join(term.split())
        
        return term.strip()
    
    def _extract_primary_artist(self, artist: str) -> str:
        """Extract primary artist name from complex collaborations"""
        if not artist:
            return ""
        
        # Split on common separators and take the first (primary) artist
        separators = [' & ', ' and ', ', ', ' feat. ', ' ft. ', ' featuring ']
        
        primary_artist = artist
        for sep in separators:
            if sep in artist.lower():
                primary_artist = artist.split(sep)[0].strip()
                break
        
        # Clean up any remaining artifacts
        primary_artist = primary_artist.replace('&', '').strip()
        
        return primary_artist
    
    async def get_fallback_artwork_url(self) -> str:
        """Get fallback artwork URL when no specific artwork is available"""
        # Return a special marker that the frontend will recognize to show vinyl fallback
        return "vinyl-fallback-placeholder"
    
    async def cleanup_old_cache(self):
        """Remove old cached artwork entries"""
        try:
            cutoff_time = datetime.now(timezone.utc) - self.cache_duration
            result = await self.db.artwork_cache.delete_many({
                'cached_at': {'$lt': cutoff_time}
            })
            logger.info(f"Cleaned up {result.deleted_count} old artwork cache entries")
        except Exception as e:
            logger.error(f"Error cleaning up artwork cache: {e}")