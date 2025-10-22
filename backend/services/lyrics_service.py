import asyncio
import aiohttp
import logging
import re
import json
import unicodedata
import time
from urllib.parse import quote
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

class LyricsService:
    def __init__(self):
        # Multiple API endpoints for better coverage
        self.apis = {
            'lyrics_ovh': {
                'base_url': 'https://api.lyrics.ovh/v1',
                'enabled': True,
                'priority': 1
            },
            'lrclib': {
                'base_url': 'https://lrclib.net/api',
                'enabled': True,
                'priority': 2
            },
            'genius': {
                'base_url': 'https://genius.com/api',
                'enabled': True,
                'priority': 3
            },
            'chartlyrics': {
                'base_url': 'http://api.chartlyrics.com/apiv1.asmx',
                'enabled': True,
                'priority': 4
            }
        }
        self.session = None
        self.cache = {}
        self.cache_expiry = 24 * 60 * 60  # 24 hours in seconds
        self.retry_config = {
            'max_retries': 2,  # Reduced from 3 for faster response
            'base_delay': 0.5,  # Reduced from 1.0
            'max_delay': 5.0,   # Reduced from 10.0
            'exponential_base': 2
        }
    
    async def get_session(self):
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=8, connect=3),  # Faster timeouts
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
        return self.session
    
    def normalize_unicode(self, text: str) -> str:
        """Normalize unicode characters for better matching"""
        if not text:
            return ""
        # Normalize unicode (convert accented characters to base forms)
        text = unicodedata.normalize('NFD', text)
        text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
        return text

    def clean_artist_name(self, artist: str) -> str:
        """Enhanced artist name cleaning with common prefixes/suffixes"""
        if not artist:
            return ""
        
        artist = self.normalize_unicode(artist)
        
        # Handle common artist prefixes/suffixes
        artist = re.sub(r'^(the|a|an)\s+', '', artist, flags=re.IGNORECASE)
        artist = re.sub(r'^(dj|mc|dr|mr|ms|mrs|sir|lady)\s+', '', artist, flags=re.IGNORECASE)
        artist = re.sub(r'\s+(jr|sr|ii|iii|iv|v)\.?$', '', artist, flags=re.IGNORECASE)
        
        # Remove featuring artists and collaborations more aggressively
        artist = re.sub(r'\s+(feat\.?|featuring|ft\.?|with|x|&|\+|vs\.?|versus)\s+.*$', '', artist, flags=re.IGNORECASE)
        artist = re.sub(r'\s+and\s+.*$', '', artist, flags=re.IGNORECASE)
        
        # Remove common suffixes
        artist = re.sub(r'\s+(band|group|orchestra|ensemble|collective|crew)$', '', artist, flags=re.IGNORECASE)
        
        # Remove anything in parentheses or brackets
        artist = re.sub(r'\s*[\(\[].*?[\)\]]', '', artist)
        
        return self.clean_search_term_basic(artist)

    def clean_title(self, title: str) -> str:
        """Enhanced title cleaning with better pattern recognition"""
        if not title:
            return ""
            
        title = self.normalize_unicode(title)
        
        # Remove version indicators (more comprehensive)
        title = re.sub(r'\s*\((.*?)?(remix|mix|version|edit|remaster|radio|single|album|live|acoustic|instrumental|extended|clean|explicit|deluxe|official|audio|video|lyric|hd|hq|bonus|demo).*?\)', '', title, flags=re.IGNORECASE)
        
        # Remove square brackets content
        title = re.sub(r'\s*\[[^\]]*\]', '', title)
        
        # Remove featuring artists more aggressively
        title = re.sub(r'\s+(feat\.?|featuring|ft\.?|with|x|&|vs\.?)\s+.*$', '', title, flags=re.IGNORECASE)
        
        # Remove common suffixes after dash/hyphen
        title = re.sub(r'\s*[-–—]\s*(remix|mix|version|edit|remaster|radio|single|album|live|acoustic|instrumental|extended|clean|explicit|deluxe|official|audio|video|lyric|bonus|demo).*$', '', title, flags=re.IGNORECASE)
        
        # Remove years
        title = re.sub(r'\s*[\(\[]?\d{4}[\)\]]?\s*', ' ', title)
        
        # Remove "official", "audio", "video" etc
        title = re.sub(r'\s+(official|audio|video|lyric|lyrics)\s+(video|audio|version)?', '', title, flags=re.IGNORECASE)
        
        return self.clean_search_term_basic(title)

    def clean_search_term_basic(self, term: str) -> str:
        """Basic cleaning for search terms"""
        if not term:
            return ""
        
        # Replace special characters with spaces (keep essential ones)
        term = re.sub(r'[^\w\s&\'-]', ' ', term)
        # Normalize whitespace
        term = re.sub(r'\s+', ' ', term)
        return term.strip()

    def clean_title_preserve_version(self, title: str) -> str:
        """Clean title while preserving version information (remaster, radio edit, etc.)"""
        if not title:
            return ""
            
        title = self.normalize_unicode(title)
        
        # Only remove featuring artists and square brackets, but keep version info
        title = re.sub(r'\s*\[[^\]]*\]', '', title)  # Remove square brackets
        title = re.sub(r'\s+(feat\.?|featuring|ft\.?|with)\s+.*$', '', title, flags=re.IGNORECASE)
        
        return self.clean_search_term_basic(title)

    def extract_version_terms(self, title: str) -> List[str]:
        """Extract version terms like 'remaster', 'radio edit' from title"""
        version_terms = []
        
        # Common version patterns
        version_patterns = [
            r'remaster(?:ed)?(?:\s+\d{4})?',
            r'radio\s+(?:edit|version|mix)',
            r'(?:single|album)\s+version',
            r'extended\s+(?:version|mix)',
            r'acoustic\s+version',
            r'live\s+version',
            r'remix',
            r'clean\s+version',
            r'explicit\s+version'
        ]
        
        title_lower = title.lower()
        for pattern in version_patterns:
            matches = re.findall(pattern, title_lower, flags=re.IGNORECASE)
            version_terms.extend(matches)
            
        return version_terms

    def generate_search_variations(self, artist: str, title: str) -> List[Tuple[str, str]]:
        """Generate multiple search variations with version-aware fallback"""
        variations = []
        seen_variations = set()  # Track unique variations
        
        clean_artist = self.clean_artist_name(artist)
        original_artist = self.clean_search_term_basic(artist)
        
        # 1. First try: Original title with version info preserved
        title_with_version = self.clean_title_preserve_version(title)
        if title_with_version:
            var_key = (clean_artist.lower(), title_with_version.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, title_with_version))
                seen_variations.add(var_key)
        
        # 2. Try with original artist (before cleaning)
        if original_artist != clean_artist:
            var_key = (original_artist.lower(), title_with_version.lower())
            if var_key not in seen_variations:
                variations.append((original_artist, title_with_version))
                seen_variations.add(var_key)
        
        # 3. Try with specific version terms if they exist
        version_terms = self.extract_version_terms(title)
        if version_terms:
            base_title = self.clean_title(title)  # Cleaned version without versions
            for version_term in version_terms:
                versioned_title = f"{base_title} {version_term}"
                var_key = (clean_artist.lower(), versioned_title.lower())
                if var_key not in seen_variations:
                    variations.append((clean_artist, versioned_title))
                    seen_variations.add(var_key)
        
        # 4. Standard cleaned version (removes version info)
        clean_title = self.clean_title(title)
        var_key = (clean_artist.lower(), clean_title.lower())
        if var_key not in seen_variations:
            variations.append((clean_artist, clean_title))
            seen_variations.add(var_key)
        
        # 5. Try without parentheses content
        title_no_parens = re.sub(r'\s*\([^)]*\)', '', title).strip()
        if title_no_parens != title:
            clean_no_parens = self.clean_title(title_no_parens)
            var_key = (clean_artist.lower(), clean_no_parens.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, clean_no_parens))
                seen_variations.add(var_key)
        
        # 6. Simplified versions - first word of artist
        simple_artist = clean_artist.split()[0] if clean_artist else ""
        simple_title = clean_title.split('(')[0].split('-')[0].strip()
        if simple_title != clean_title:
            var_key = (clean_artist.lower(), simple_title.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, simple_title))
                seen_variations.add(var_key)
            
            var_key = (simple_artist.lower(), simple_title.lower())
            if var_key not in seen_variations and simple_artist:
                variations.append((simple_artist, simple_title))
                seen_variations.add(var_key)
        
        # 7. Try with just first few words of title
        title_words = clean_title.split()
        if len(title_words) > 3:
            short_title = ' '.join(title_words[:3])
            var_key = (clean_artist.lower(), short_title.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, short_title))
                seen_variations.add(var_key)
        
        # 8. Very basic versions
        basic_artist = self.clean_search_term_basic(artist)
        basic_title = self.clean_search_term_basic(title.split('(')[0])
        if basic_title != clean_title:
            var_key = (basic_artist.lower(), basic_title.lower())
            if var_key not in seen_variations:
                variations.append((basic_artist, basic_title))
                seen_variations.add(var_key)
        
        # 9. Try with common alternative version terms
        if any(term in title.lower() for term in ['remaster', 'radio edit', 'radio version', '2024', '2023', '2022']):
            alt_variations = []
            if 'remaster' in title.lower():
                alt_variations.extend([
                    f"{clean_title} remastered",
                    f"{clean_title} remaster",
                    clean_title  # Without remaster info
                ])
            if 'radio' in title.lower():
                alt_variations.extend([
                    f"{clean_title} radio version",
                    f"{clean_title} radio edit",
                    clean_title  # Without radio info
                ])
            # Remove year information
            title_no_year = re.sub(r'\s*\d{4}\s*', ' ', clean_title).strip()
            if title_no_year != clean_title:
                alt_variations.append(title_no_year)
            
            for alt_title in alt_variations:
                var_key = (clean_artist.lower(), alt_title.lower())
                if var_key not in seen_variations:
                    variations.append((clean_artist, alt_title))
                    seen_variations.add(var_key)
        
        # 10. Try reversing artist and title (sometimes they get swapped)
        var_key = (clean_title.lower(), clean_artist.lower())
        if var_key not in seen_variations:
            variations.append((clean_title, clean_artist))
            seen_variations.add(var_key)
        
        # 11. Try removing all punctuation
        artist_no_punct = re.sub(r'[^\w\s]', '', clean_artist)
        title_no_punct = re.sub(r'[^\w\s]', '', clean_title)
        if artist_no_punct != clean_artist or title_no_punct != clean_title:
            var_key = (artist_no_punct.lower(), title_no_punct.lower())
            if var_key not in seen_variations:
                variations.append((artist_no_punct, title_no_punct))
                seen_variations.add(var_key)
        
        # 12. Try common misspellings and phonetic variations
        # Replace common letter combinations
        title_phonetic = clean_title
        title_phonetic = re.sub(r'ph', 'f', title_phonetic, flags=re.IGNORECASE)
        title_phonetic = re.sub(r'ck', 'k', title_phonetic, flags=re.IGNORECASE)
        if title_phonetic != clean_title:
            var_key = (clean_artist.lower(), title_phonetic.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, title_phonetic))
                seen_variations.add(var_key)
        
        # 13. Try with just the main noun/first word if title is very long
        title_words = clean_title.split()
        if len(title_words) > 5:
            # Try first 2 words
            short_title = ' '.join(title_words[:2])
            var_key = (clean_artist.lower(), short_title.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, short_title))
                seen_variations.add(var_key)
        
        # 14. Try with 'the' prefix if not present
        if not clean_title.lower().startswith('the '):
            with_the = f"the {clean_title}"
            var_key = (clean_artist.lower(), with_the.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, with_the))
                seen_variations.add(var_key)
        
        # 15. Try without 'the' prefix if present
        if clean_title.lower().startswith('the '):
            without_the = clean_title[4:]
            var_key = (clean_artist.lower(), without_the.lower())
            if var_key not in seen_variations:
                variations.append((clean_artist, without_the))
                seen_variations.add(var_key)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for var in variations:
            if var not in seen and var[0] and var[1]:  # Both must be non-empty
                seen.add(var)
                unique_variations.append(var)
        
        return unique_variations
    
    def get_cache_key(self, artist, title):
        """Generate cache key"""
        clean_artist = self.clean_search_term_basic(artist).lower()
        clean_title = self.clean_search_term_basic(title).lower()
        return f"{clean_artist}-{clean_title}"
    
    def is_cache_valid(self, timestamp):
        """Check if cache entry is still valid"""
        import time
        return (time.time() - timestamp) < self.cache_expiry
    
    async def retry_with_backoff(self, func, *args, **kwargs):
        """Retry function with exponential backoff"""
        last_exception = None
        
        for attempt in range(self.retry_config['max_retries']):
            try:
                return await func(*args, **kwargs)
            except (asyncio.TimeoutError, aiohttp.ClientError) as e:
                last_exception = e
                if attempt < self.retry_config['max_retries'] - 1:
                    delay = min(
                        self.retry_config['base_delay'] * (self.retry_config['exponential_base'] ** attempt),
                        self.retry_config['max_delay']
                    )
                    logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"All {self.retry_config['max_retries']} attempts failed")
        
        if last_exception:
            raise last_exception

    async def fetch_from_lyrics_ovh(self, artist: str, title: str) -> Optional[Dict]:
        """Fetch lyrics from lyrics.ovh API"""
        session = await self.get_session()
        encoded_artist = quote(artist)
        encoded_title = quote(title)
        url = f"{self.apis['lyrics_ovh']['base_url']}/{encoded_artist}/{encoded_title}"
        
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                if 'lyrics' in data and data['lyrics'] and data['lyrics'].strip():
                    return {
                        "lyrics": self.process_lyrics(data['lyrics']),
                        "source": "lyrics.ovh",
                        "confidence": 0.9
                    }
            return None

    async def fetch_from_lrclib(self, artist: str, title: str) -> Optional[Dict]:
        """Fetch lyrics from lrclib.net API"""
        try:
            session = await self.get_session()
            # lrclib uses a search endpoint
            url = f"{self.apis['lrclib']['base_url']}/search"
            params = {
                'artist_name': artist,
                'track_name': title
            }
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        # Get the first result
                        result = data[0]
                        lyrics_text = result.get('plainLyrics') or result.get('syncedLyrics', '')
                        if lyrics_text and lyrics_text.strip():
                            return {
                                "lyrics": self.process_lyrics(lyrics_text),
                                "source": "lrclib.net",
                                "confidence": 0.85
                            }
                return None
        except Exception as e:
            logger.warning(f"lrclib fetch error: {e}")
            return None

    async def fetch_from_genius(self, artist: str, title: str) -> Optional[Dict]:
        """Fetch lyrics from Genius (simplified search)"""
        try:
            session = await self.get_session()
            # Search for the song
            search_query = f"{artist} {title}".strip()
            url = f"https://genius.com/api/search/multi"
            params = {'q': search_query}
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    # Try to find song in response
                    sections = data.get('response', {}).get('sections', [])
                    for section in sections:
                        if section.get('type') == 'song':
                            hits = section.get('hits', [])
                            if hits:
                                song = hits[0].get('result', {})
                                song_title = song.get('title', '').lower()
                                song_artist = song.get('primary_artist', {}).get('name', '').lower()
                                
                                # Check if it's a reasonable match
                                if (title.lower()[:10] in song_title or song_title[:10] in title.lower()) and \
                                   (artist.lower()[:10] in song_artist or song_artist[:10] in artist.lower()):
                                    # Found a match, return partial success (we can't get full lyrics easily)
                                    logger.info(f"Found on Genius: {song_title} by {song_artist}")
                                    # Note: Full Genius lyrics would require web scraping
                                    # For now, just log the match
                                    return None
            return None
        except Exception as e:
            logger.warning(f"Genius fetch error: {e}")
            return None

    async def fetch_from_chartlyrics(self, artist: str, title: str) -> Optional[Dict]:
        """Fetch lyrics from ChartLyrics API"""
        try:
            session = await self.get_session()
            # ChartLyrics uses a different URL format
            url = f"{self.apis['chartlyrics']['base_url']}/SearchLyricDirect"
            params = {'artist': artist, 'song': title}
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    content = await response.text()
                    # ChartLyrics returns XML, parse it
                    if content and 'Lyric' in content and len(content.strip()) > 100:
                        # Extract lyrics from XML (simplified)
                        import xml.etree.ElementTree as ET
                        try:
                            root = ET.fromstring(content)
                            lyric_elem = root.find('.//Lyric')
                            if lyric_elem is not None and lyric_elem.text:
                                lyrics_text = lyric_elem.text.strip()
                                if lyrics_text and lyrics_text != "Not found":
                                    return {
                                        "lyrics": self.process_lyrics(lyrics_text),
                                        "source": "chartlyrics",
                                        "confidence": 0.8
                                    }
                        except ET.ParseError:
                            pass
        except Exception as e:
            logger.warning(f"ChartLyrics API error: {e}")
        return None

    async def fetch_lyrics_from_api(self, artist: str, title: str, api_name: str) -> Optional[Dict]:
        """Fetch lyrics from a specific API"""
        if api_name == 'lyrics_ovh':
            return await self.fetch_from_lyrics_ovh(artist, title)
        elif api_name == 'lrclib':
            return await self.fetch_from_lrclib(artist, title)
        elif api_name == 'genius':
            return await self.fetch_from_genius(artist, title)
        elif api_name == 'chartlyrics':
            return await self.fetch_from_chartlyrics(artist, title)
        return None

    async def fetch_lyrics(self, artist: str, title: str):
        """
        Fetch lyrics using progressive fallback strategy with multiple APIs
        """
        if not artist or not title:
            logger.warning("Artist and title are required for lyrics lookup")
            return {"error": "Artist and title are required"}
        
        # Check cache first
        cache_key = self.get_cache_key(artist, title)
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if self.is_cache_valid(timestamp):
                logger.info(f"Lyrics found in cache for: {artist} - {title}")
                return cached_data
            else:
                del self.cache[cache_key]
        
        logger.info(f"Fetching lyrics for: {artist} - {title}")
        
        # Generate search variations for progressive fallback
        search_variations = self.generate_search_variations(artist, title)
        
        # Get enabled APIs sorted by priority
        enabled_apis = sorted(
            [(name, config) for name, config in self.apis.items() if config['enabled']],
            key=lambda x: x[1]['priority']
        )
        
        best_result = None
        errors = []
        
        # Try each search variation
        for variation_idx, (search_artist, search_title) in enumerate(search_variations):
            logger.info(f"Trying variation {variation_idx + 1}: '{search_artist}' - '{search_title}'")
            
            # Try each API for this variation
            for api_name, api_config in enabled_apis:
                try:
                    logger.info(f"Trying {api_name} API...")
                    result = await self.retry_with_backoff(
                        self.fetch_lyrics_from_api, search_artist, search_title, api_name
                    )
                    
                    if result and result.get('lyrics'):
                        logger.info(f"Lyrics found using {api_name} (variation {variation_idx + 1})")
                        result['search_variation'] = variation_idx + 1
                        result['search_terms'] = f"{search_artist} - {search_title}"
                        
                        # Cache the result
                        self.cache[cache_key] = (result, time.time())
                        return result
                        
                except Exception as e:
                    error_msg = f"{api_name} failed: {str(e)}"
                    errors.append(error_msg)
                    logger.warning(error_msg)
                    continue
        
        # No lyrics found with any method
        error_result = {
            "error": "No lyrics found",
            "tried_variations": len(search_variations),
            "tried_apis": [name for name, _ in enabled_apis],
            "errors": errors
        }
        
        # Cache negative result for shorter time (1 hour)
        self.cache[cache_key] = (error_result, time.time() - (self.cache_expiry - 3600))
        
        logger.info(f"No lyrics found for {artist} - {title} after trying {len(search_variations)} variations and {len(enabled_apis)} APIs")
        return error_result
    
    def process_lyrics(self, lyrics_text: str) -> List[Dict]:
        """Enhanced lyrics processing with better formatting"""
        if not lyrics_text:
            return []
        
        # Clean up the lyrics text
        lyrics_text = lyrics_text.strip()
        
        # Remove common unwanted patterns
        lyrics_text = re.sub(r'.*?Lyrics.*?\n', '', lyrics_text, flags=re.IGNORECASE)
        lyrics_text = re.sub(r'.*?Songwriters.*?\n', '', lyrics_text, flags=re.IGNORECASE)
        lyrics_text = re.sub(r'.*?Published by.*?\n', '', lyrics_text, flags=re.IGNORECASE)
        
        # Split into lines and process
        lines = lyrics_text.split('\n')
        processed_lines = []
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # Skip common metadata patterns
            if re.match(r'^\[.*\]$', line):  # [Verse], [Chorus] markers
                continue
            if re.match(r'^.*?Lyrics by.*$', line, flags=re.IGNORECASE):
                continue
            if re.match(r'^.*?Written by.*$', line, flags=re.IGNORECASE):
                continue
                
            # Skip lines that are just repetition markers
            if line.lower() in ['(repeat)', '(2x)', '(x2)', '(x3)', '(x4)']:
                continue
                
            # Clean the line
            line = re.sub(r'\s+', ' ', line)  # Normalize whitespace
            
            if len(line) > 0:
                processed_lines.append({
                    "text": line,
                    "id": len(processed_lines)
                })
        
        return processed_lines
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()

# Create singleton instance
lyrics_service = LyricsService()