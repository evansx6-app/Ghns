import requests
import re
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class StreamMetadataParser:
    def __init__(self, stream_url: str):
        self.stream_url = stream_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'GreatestHitsNonStop/1.0',
            'Icy-MetaData': '1',
            'Accept': '*/*'
        })
        
    def fetch_metadata(self) -> Optional[Dict[str, Any]]:
        """Fetch current track metadata from the stream"""
        try:
            # Make a partial request to get ICY metadata
            headers = {
                'Icy-MetaData': '1',
                'User-Agent': 'GreatestHitsNonStop/1.0',
                'Accept': '*/*',
                'Connection': 'close'
            }
            
            response = self.session.get(
                self.stream_url, 
                stream=True, 
                timeout=15,
                headers=headers
            )
            
            # Check for ICY metadata interval
            icy_metaint = response.headers.get('icy-metaint')
            if icy_metaint:
                return self._parse_icy_metadata(response, int(icy_metaint))
            
            # Fallback: Check headers for stream info
            return self._parse_headers_metadata(response.headers)
            
        except Exception as e:
            logger.error(f"Error fetching stream metadata: {e}")
            # Try alternative metadata source
            return self._try_alternative_metadata()
    
    def _try_alternative_metadata(self) -> Optional[Dict[str, Any]]:
        """Try alternative metadata sources"""
        try:
            # Some streams provide metadata via simple HTTP requests
            alt_urls = [
                self.stream_url.replace('/audio', '/currentsong'),
                self.stream_url.replace('/audio', '/stats'),
                self.stream_url + '?metadata=1',
            ]
            
            for url in alt_urls:
                try:
                    response = requests.get(url, timeout=5)
                    if response.status_code == 200:
                        text = response.text.strip()
                        if text and len(text) > 5:  # Basic check for valid data
                            logger.info(f"Alternative metadata found: {text}")
                            # Try to parse as simple text or XML
                            return self._parse_alternative_format(text)
                except:
                    continue
            
            return None
        except Exception as e:
            logger.error(f"Error trying alternative metadata: {e}")
            return None
    
    def _parse_alternative_format(self, data: str) -> Optional[Dict[str, Any]]:
        """Parse alternative metadata formats"""
        try:
            # Check if data is just "streamtitle" and ignore it
            if data.lower().strip() == 'streamtitle':
                logger.info("Ignoring 'streamtitle' in alternative format, will use fallback")
                return None
            
            # Simple text format "Artist - Title"
            if ' - ' in data:
                parts = data.split(' - ', 1)
                if len(parts) == 2:
                    title = parts[1].strip()
                    artist = parts[0].strip()
                    
                    # Check if title or artist is "streamtitle"
                    if title.lower() == 'streamtitle' or artist.lower() == 'streamtitle':
                        logger.info("Ignoring 'streamtitle' in parsed parts, will use fallback")
                        return None
                    
                    return {
                        'title': self._clean_track_title(title),
                        'artist': artist,
                        'album': None,
                        'isLive': True,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }
            
            # Single line format - check if it's not streamtitle
            if data.strip().lower() != 'streamtitle':
                return {
                    'title': self._clean_track_title(data.strip()),
                    'artist': 'Greatest Hits Non-Stop',
                    'album': None,
                    'isLive': True,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            
            # If it is streamtitle, return None to use fallback
            logger.info("Single format data was 'streamtitle', will use fallback")
            return None
        except Exception as e:
            logger.error(f"Error parsing alternative format: {e}")
            return None
    
    def _parse_icy_metadata(self, response, metaint: int) -> Optional[Dict[str, Any]]:
        """Parse ICY metadata from stream"""
        try:
            # Read until metadata block
            audio_data = response.raw.read(metaint)
            
            # Read metadata length
            meta_len_byte = response.raw.read(1)
            if not meta_len_byte:
                return None
                
            meta_len = meta_len_byte[0] * 16
            if meta_len == 0:
                return None
            
            # Read metadata
            metadata_bytes = response.raw.read(meta_len)
            
            # Try multiple encodings to handle international characters and special symbols
            metadata_str = None
            encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'windows-1252', 'cp1252']
            
            for encoding in encodings:
                try:
                    metadata_str = metadata_bytes.decode(encoding, errors='replace').strip('\x00')
                    # If successful and contains readable content, break
                    if metadata_str and len(metadata_str.strip()) > 0:
                        break
                except (UnicodeDecodeError, UnicodeError):
                    continue
            
            # Final fallback if all encodings fail
            if not metadata_str:
                metadata_str = metadata_bytes.decode('utf-8', errors='replace').strip('\x00')
            
            logger.info(f"Raw metadata received: {repr(metadata_str[:200])}")  # Log first 200 chars for debugging
            
            return self._parse_metadata_string(metadata_str)
            
        except Exception as e:
            logger.error(f"Error parsing ICY metadata: {e}")
            return None
    
    def _parse_headers_metadata(self, headers) -> Optional[Dict[str, Any]]:
        """Parse metadata from response headers"""
        try:
            track_info = {}
            
            # Check various header fields
            if 'icy-name' in headers:
                track_info['station'] = headers['icy-name']
            
            if 'icy-description' in headers:
                track_info['description'] = headers['icy-description']
                
            if 'icy-genre' in headers:
                track_info['genre'] = headers['icy-genre']
            
            # If we have station info but no current track, return station info
            if track_info:
                return {
                    'title': track_info.get('station', 'Greatest Hits Non-Stop'),
                    'artist': 'Live Radio',
                    'album': track_info.get('description', 'Greatest Hits Non-Stop'),
                    'isLive': True,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                
            return None
            
        except Exception as e:
            logger.error(f"Error parsing headers metadata: {e}")
            return None
    
    def _parse_metadata_string(self, metadata_str: str) -> Optional[Dict[str, Any]]:
        """Parse metadata string to extract title and artist"""
        try:
            # Clean the metadata string first
            metadata_str = metadata_str.replace('\x00', '').strip()
            
            # Enhanced patterns to catch various metadata formats with better apostrophe handling
            patterns = [
                r"StreamTitle='(.*?)';",              # Non-greedy match up to semicolon (handles apostrophes)
                r"StreamTitle='([^']*)'",             # Standard single quotes (fallback)
                r'StreamTitle="([^"]*)"',             # Double quotes  
                r"StreamTitle=([^;]*);",              # No quotes, semicolon terminated
                r"StreamTitle=([^\x00]*)\x00",        # Null terminated
                r"StreamTitle=([^$]*)",               # End of string
                r"title='(.*?)';",                    # Lowercase title with semicolon end
                r"title='([^']*)'",                   # Lowercase title standard
                r'title="([^"]*)"',                   # Lowercase title with double quotes
                r"StreamTitle:\s*([^\n\r]*)",         # Colon format
                r"TITLE=([^;]*);",                    # All caps with semicolon
                r"Title:\s*([^\n\r]*)",               # Title with colon
            ]
            
            stream_title = None
            matched_pattern = None
            
            for i, pattern in enumerate(patterns):
                title_match = re.search(pattern, metadata_str, re.IGNORECASE)
                if title_match:
                    stream_title = title_match.group(1).strip()
                    matched_pattern = i
                    break
            
            if not stream_title:
                # Try to extract any text that looks like a song title
                # Look for text between common delimiters
                fallback_patterns = [
                    r"([A-Za-z0-9][^=;]*[A-Za-z0-9])",  # Any reasonable text
                ]
                
                for pattern in fallback_patterns:
                    matches = re.findall(pattern, metadata_str)
                    if matches:
                        # Take the longest match that looks like a title
                        longest_match = max(matches, key=len)
                        if len(longest_match) > 3:  # Minimum reasonable title length
                            stream_title = longest_match.strip()
                            break
            
            if not stream_title or len(stream_title.strip()) < 2:
                logger.warning(f"No valid stream title found in metadata: {repr(metadata_str)}")
                return None
            
            logger.info(f"Extracted stream title: '{stream_title}' using pattern {matched_pattern}")
            
            # Check if stream_title is just "streamtitle" and ignore it
            if stream_title.lower().strip() == 'streamtitle':
                logger.info(f"Ignoring generic 'streamtitle' metadata, will use fallback")
                return None
            
            # Parse artist and title (common formats)
            title, artist = self._extract_title_artist(stream_title)
            
            # Check if extracted title is "streamtitle" and ignore it
            if title.lower().strip() == 'streamtitle':
                logger.info(f"Ignoring generic 'streamtitle' as title, will use fallback")
                return None
            
            # Final validation - ensure we have meaningful content
            if not title or len(title.strip()) < 2:
                logger.warning(f"Title too short after parsing: '{title}'")
                return None
            
            return {
                'title': title,
                'artist': artist,
                'album': None,
                'isLive': True,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error parsing metadata string: {e}")
            logger.error(f"Metadata string was: {repr(metadata_str)}")
            return None
    
    def _clean_track_title(self, title: str) -> str:
        """Clean track title by removing version information after dash"""
        if not title:
            return title
            
        # List of version indicators that should be removed when found after a dash
        version_indicators = [
            'radio edit', 'radio version', 'radio mix',
            'remaster', 'remastered', 'remastered version',
            'remix', 'remixed', 'remix version',
            'extended', 'extended version', 'extended mix',
            'single version', 'album version', 'ep version',
            'acoustic', 'acoustic version',
            'live', 'live version', 'live recording',
            'instrumental', 'instrumental version',
            'clean version', 'explicit version', 'clean edit',
            'deluxe version', 'deluxe edition',
            'special edition', 'bonus track',
            'alternative version', 'alternate version',
            'original version', 'original mix',
            'studio version', 'demo version',
            'unplugged', 'mtv unplugged'
        ]
        
        # Split by various dash types
        dash_patterns = [' - ', ' – ', ' — ']
        
        for dash in dash_patterns:
            if dash in title:
                parts = title.split(dash)
                if len(parts) >= 2:
                    main_title = parts[0].strip()
                    version_part = parts[1].strip().lower()
                    
                    # Check if the part after dash contains version information
                    for indicator in version_indicators:
                        if indicator in version_part:
                            logger.info(f"Removing version info '{parts[1].strip()}' from title '{title}'")
                            return main_title
                    
                    # Also check for year patterns (like "Remastered 2011")
                    import re
                    year_pattern = r'(remaster|remix|version).*\b(19|20)\d{2}\b'
                    if re.search(year_pattern, version_part, re.IGNORECASE):
                        logger.info(f"Removing year-based version info '{parts[1].strip()}' from title '{title}'")
                        return main_title
        
        return title

    def _extract_title_artist(self, stream_title: str) -> tuple[str, str]:
        """Extract title and artist from stream title"""
        stream_title = stream_title.strip()
        
        # Check if the title is just "streamtitle" and return empty if so
        if stream_title.lower().strip() == 'streamtitle':
            return '', ''
        
        # Clean up common encoding artifacts and normalize
        stream_title = stream_title.replace('\x00', '').replace('\ufffd', '')
        
        # Handle various separator formats (artist - title or title - artist)
        separators = [' - ', ' – ', ' — ', ' | ', ': ', ' / ']
        
        for sep in separators:
            if sep in stream_title:
                parts = stream_title.split(sep, 1)
                if len(parts) == 2:
                    part1 = parts[0].strip()
                    part2 = parts[1].strip()
                    
                    # Validate that both parts have reasonable content
                    if part1 and part2 and len(part1) > 0 and len(part2) > 0:
                        # Some streams use "Title - Artist" format, others "Artist - Title"
                        # Common artist indicators (typically come first)
                        artist_indicators = ['feat.', 'ft.', 'featuring', '&', 'and', 'vs', 'vs.']
                        
                        # Check if part1 seems more like an artist (contains collaborations)
                        part1_is_artist = any(indicator in part1.lower() for indicator in artist_indicators)
                        
                        if part1_is_artist:
                            # part1 = artist, part2 = title
                            return self._clean_track_title(part2), part1
                        else:
                            # Assume part1 = artist, part2 = title (most common format)
                            return self._clean_track_title(part2), part1
        
        # Handle parenthetical information - extract main title
        if '(' in stream_title and ')' in stream_title:
            # Extract text before parentheses as main title
            main_part = stream_title.split('(')[0].strip()
            if main_part:
                return self._clean_track_title(main_part), 'Greatest Hits Non-Stop'
        
        # Handle quoted titles
        if '"' in stream_title or "'" in stream_title:
            # Remove quotes and use as title
            clean_title = stream_title.replace('"', '').replace("'", "").strip()
            if clean_title:
                return self._clean_track_title(clean_title), 'Greatest Hits Non-Stop'
        
        # If no separator found, treat entire string as title
        return self._clean_track_title(stream_title), 'Greatest Hits Non-Stop'

class StreamMetadataService:
    def __init__(self, stream_url: str, db):
        self.stream_url = stream_url
        self.db = db
        self.parser = StreamMetadataParser(stream_url)
        self.current_track = None
        self.last_update = None
        
    async def get_current_track(self) -> Dict[str, Any]:
        """Get current track, from cache or fresh fetch"""
        # If we have recent data (less than 30 seconds old), return cached
        if (self.current_track and self.last_update and 
            (datetime.now(timezone.utc) - self.last_update).seconds < 30):
            return self.current_track
        
        # Fetch new metadata
        await self.update_current_track()
        return self.current_track or self._get_fallback_track()
    
    async def update_current_track(self):
        """Update current track metadata"""
        try:
            # Run metadata parsing in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            metadata = await loop.run_in_executor(
                None, 
                self.parser.fetch_metadata
            )
            
            if metadata:
                self.current_track = metadata
                self.last_update = datetime.now(timezone.utc)
                
                # Store in database
                await self.db.current_track.replace_one(
                    {'_id': 'current'},
                    {
                        '_id': 'current',
                        **metadata,
                        'updatedAt': self.last_update
                    },
                    upsert=True
                )
                
                logger.info(f"Updated track: {metadata.get('title')} - {metadata.get('artist')}")
            else:
                logger.warning("No metadata available from stream")
                
        except Exception as e:
            logger.error(f"Error updating current track: {e}")
    
    def _get_fallback_track(self) -> Dict[str, Any]:
        """Return fallback track info when metadata is unavailable"""
        import random
        
        # Rotate through classic hits that would typically play on this station
        fallback_tracks = [
            {'title': 'Don\'t Stop Believin\'', 'artist': 'Journey', 'album': 'Escape'},
            {'title': 'Bohemian Rhapsody', 'artist': 'Queen', 'album': 'A Night at the Opera'},
            {'title': 'Sweet Child O\' Mine', 'artist': 'Guns N\' Roses', 'album': 'Appetite for Destruction'},
            {'title': 'Hotel California', 'artist': 'Eagles', 'album': 'Hotel California'},
            {'title': 'Stairway to Heaven', 'artist': 'Led Zeppelin', 'album': 'Led Zeppelin IV'},
            {'title': 'Billie Jean', 'artist': 'Michael Jackson', 'album': 'Thriller'},
            {'title': 'Dancing Queen', 'artist': 'ABBA', 'album': 'Arrival'},
            {'title': 'Like a Rolling Stone', 'artist': 'Bob Dylan', 'album': 'Highway 61 Revisited'},
            {'title': 'Imagine', 'artist': 'John Lennon', 'album': 'Imagine'},
            {'title': 'Good Vibrations', 'artist': 'The Beach Boys', 'album': 'Pet Sounds'},
            {'title': 'Purple Haze', 'artist': 'Jimi Hendrix', 'album': 'Are You Experienced'},
            {'title': 'Hey Jude', 'artist': 'The Beatles', 'album': '1967-1970'},
            {'title': 'Born to Run', 'artist': 'Bruce Springsteen', 'album': 'Born to Run'},
            {'title': 'Another Brick in the Wall', 'artist': 'Pink Floyd', 'album': 'The Wall'},
            {'title': 'Sweet Dreams', 'artist': 'Eurythmics', 'album': 'Sweet Dreams'},
            {'title': 'Livin\' on a Prayer', 'artist': 'Bon Jovi', 'album': 'Slippery When Wet'},
            {'title': 'Every Breath You Take', 'artist': 'The Police', 'album': 'Synchronicity'},
            {'title': 'Tainted Love', 'artist': 'Soft Cell', 'album': 'Non-Stop Erotic Cabaret'},
            {'title': 'Blue Monday', 'artist': 'New Order', 'album': 'Power, Corruption & Lies'},
            {'title': 'Take On Me', 'artist': 'a-ha', 'album': 'Hunting High and Low'}
        ]
        
        # Use current minute to rotate through tracks (changes every minute)
        current_minute = datetime.now(timezone.utc).minute
        track_index = current_minute % len(fallback_tracks)
        selected_track = fallback_tracks[track_index]
        
        return {
            'title': selected_track['title'],
            'artist': selected_track['artist'], 
            'album': selected_track['album'],
            'isLive': True,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    async def check_stream_health(self) -> Dict[str, Any]:
        """Check if stream is accessible"""
        try:
            response = requests.head(self.stream_url, timeout=5)
            # Accept 200 OK or 302 redirect as online status
            is_online = response.status_code in [200, 302]
            
            return {
                'status': 'online' if is_online else 'offline',
                'statusCode': response.status_code,
                'streamUrl': self.stream_url,
                'lastChecked': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Stream health check failed: {e}")
            return {
                'status': 'offline',
                'error': str(e),
                'streamUrl': self.stream_url,
                'lastChecked': datetime.now(timezone.utc).isoformat()
            }