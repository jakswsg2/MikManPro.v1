"""
Phase 15: Metadata Normalizer
Standardizes genres (Arabic & English), credits, ratings, artwork URLs and item types.
"""
from typing import Dict, Any, List, Optional
import re
from apps.content.metadata.base import UnifiedMetadata

# Comprehensive Arabic Genre Taxonomy
GENRE_MAP_EN_TO_AR = {
    "action": "أكشن",
    "action & adventure": "أكشن ومغامرة",
    "adventure": "مغامرة",
    "animation": "رسوم متحركة",
    "anime": "أنمي",
    "comedy": "كوميديا",
    "crime": "جريمة",
    "documentary": "وثائقي",
    "drama": "دراما",
    "family": "عائلي",
    "fantasy": "فانتازيا",
    "history": "تاريخي",
    "horror": "رعب",
    "music": "موسيقي",
    "musical": "غنائي",
    "mystery": "غموض",
    "news": "أخبار",
    "reality": "تلفزيون الواقع",
    "romance": "رومانسي",
    "sci-fi": "خيال علمي",
    "sci-fi & fantasy": "خيال علمي وفانتازيا",
    "science fiction": "خيال علمي",
    "soap": "دراما تلفزيونية",
    "talk": "حوار",
    "thriller": "إثارة وتشويق",
    "tv movie": "فيلم تلفزيوني",
    "war": "حربي",
    "war & politics": "حرب وسياسة",
    "western": "غربي (ويسترن)",
    "kids": "أطفال",
    "sport": "رياضة"
}

# Standard Role Translation
ROLE_MAP_EN_TO_AR = {
    "actor": "ممثل",
    "actress": "ممثلة",
    "director": "مخرج",
    "writer": "كاتب",
    "screenplay": "سيناريو وحوار",
    "producer": "منتج",
    "executive producer": "منتج تنفيذي",
    "composer": "مؤلف الموسيقى التصويرية",
    "original music composer": "مؤلف الموسيقى التصويرية",
    "cinematography": "مدير التصوير",
    "editor": "مونتير"
}


class MetadataNormalizer:
    """Normalizes provider-specific payloads into clean, unified schemas."""

    @staticmethod
    def normalize_genre(genre_name: str) -> Dict[str, str]:
        """
        Returns a dictionary with English and Arabic names for a genre.
        e.g. {'en': 'Action', 'ar': 'أكشن'}
        """
        clean = genre_name.strip()
        lower = clean.lower()
        ar_name = GENRE_MAP_EN_TO_AR.get(lower, clean)
        return {"en": clean.title(), "ar": ar_name}

    @staticmethod
    def map_genres_to_arabic(genres: List[str]) -> List[str]:
        """Transforms a list of English genre names into standardized Arabic genre names."""
        result = []
        for g in genres:
            if not g:
                continue
            lower = g.strip().lower()
            ar = GENRE_MAP_EN_TO_AR.get(lower, g.strip())
            if ar not in result:
                result.append(ar)
        return result

    @staticmethod
    def normalize_role(role_name: str) -> str:
        """Standardizes role names into canonical roles: Actor, Director, Writer, Producer, Composer, Other."""
        lower = (role_name or "").strip().lower()
        if any(w in lower for w in ["actor", "actress", "cast"]):
            return "Actor"
        if "director" in lower:
            return "Director"
        if any(w in lower for w in ["writer", "screenplay", "author"]):
            return "Writer"
        if "producer" in lower:
            return "Producer"
        if any(w in lower for w in ["composer", "music", "score"]):
            return "Composer"
        return role_name.title() if role_name else "Crew"

    @staticmethod
    def format_tmdb_image_url(path: Optional[str], size: str = "w500") -> str:
        """Constructs full TMDB image URL from relative path."""
        if not path:
            return ""
        if path.startswith("http://") or path.startswith("https://"):
            return path
        clean_path = path.lstrip("/")
        return f"https://image.tmdb.org/t/p/{size}/{clean_path}"

    @staticmethod
    def extract_year(date_str: Optional[str]) -> Optional[int]:
        """Safely extracts a 4-digit year from dates like '2010-07-16'."""
        if not date_str:
            return None
        match = re.search(r'\b(19\d\d|20\d\d)\b', str(date_str))
        if match:
            return int(match.group(1))
        return None

    @classmethod
    def normalize_tmdb_movie(
        cls,
        data: Dict[str, Any],
        language: str = "ar"
    ) -> UnifiedMetadata:
        """Standardizes a TMDB movie details response into UnifiedMetadata."""
        title = data.get("title") or data.get("original_title") or ""
        original_title = data.get("original_title") or title
        overview = data.get("overview") or ""
        tagline = data.get("tagline") or ""

        release_date = data.get("release_date") or ""
        year = cls.extract_year(release_date)
        duration = data.get("runtime") or 0

        # Genres
        genre_list = [g.get("name") for g in data.get("genres", []) if g.get("name")]
        genres_ar = cls.map_genres_to_arabic(genre_list)

        # Poster & Backdrop
        poster = cls.format_tmdb_image_url(data.get("poster_path"), "w500")
        backdrop = cls.format_tmdb_image_url(data.get("backdrop_path"), "original")

        # Ratings
        rating = float(data.get("vote_average", 0.0))
        rating_count = int(data.get("vote_count", 0))

        # External IDs
        ext_ids = {}
        if "id" in data:
            ext_ids["tmdb"] = str(data["id"])
        if data.get("imdb_id"):
            ext_ids["imdb"] = str(data["imdb_id"])
        if "external_ids" in data:
            raw_ext = data["external_ids"]
            for k in ["imdb_id", "tvdb_id", "wikidata_id", "facebook_id", "instagram_id", "twitter_id"]:
                if raw_ext.get(k):
                    clean_k = k.replace("_id", "")
                    ext_ids[clean_k] = str(raw_ext[k])

        # Credits / People
        people = []
        credits = data.get("credits", {})
        # Cast
        for c in credits.get("cast", [])[:15]:
            people.append({
                "name": c.get("name"),
                "role": "Actor",
                "character": c.get("character", ""),
                "profile_path": cls.format_tmdb_image_url(c.get("profile_path"), "w185"),
                "order": c.get("order", 0)
            })
        # Crew (Directors & Writers)
        for crew in credits.get("crew", []):
            job = crew.get("job", "")
            norm_role = cls.normalize_role(job)
            if norm_role in ["Director", "Writer", "Composer"]:
                people.append({
                    "name": crew.get("name"),
                    "role": norm_role,
                    "job": job,
                    "profile_path": cls.format_tmdb_image_url(crew.get("profile_path"), "w185")
                })

        # Tags / Keywords
        tags = []
        keywords = data.get("keywords", {}).get("keywords", [])
        for kw in keywords:
            if kw.get("name"):
                tags.append(kw.get("name"))

        # Localized mappings
        title_loc = {language: title}
        overview_loc = {language: overview} if overview else {}
        tagline_loc = {language: tagline} if tagline else {}

        if original_title and language != "en":
            title_loc["en"] = original_title

        return UnifiedMetadata(
            title=title,
            original_title=original_title,
            title_localized=title_loc,
            overview=overview,
            overview_localized=overview_loc,
            tagline=tagline,
            tagline_localized=tagline_loc,
            year=year,
            release_date=release_date,
            duration_minutes=duration,
            item_type="movie",
            genres=genre_list,
            genres_ar=genres_ar,
            tags=tags[:20],
            community_rating=round(rating, 1),
            community_rating_count=rating_count,
            poster_url=poster,
            backdrop_url=backdrop,
            people=people,
            external_ids=ext_ids,
            raw_payload=data
        )

    @classmethod
    def normalize_tmdb_series(
        cls,
        data: Dict[str, Any],
        language: str = "ar"
    ) -> UnifiedMetadata:
        """Standardizes a TMDB TV series details response into UnifiedMetadata."""
        title = data.get("name") or data.get("original_name") or ""
        original_title = data.get("original_name") or title
        overview = data.get("overview") or ""
        tagline = data.get("tagline") or ""

        first_air_date = data.get("first_air_date") or ""
        year = cls.extract_year(first_air_date)

        # Duration: average episode run time
        runtimes = data.get("episode_run_time", [])
        duration = runtimes[0] if runtimes else 45

        # Genres
        genre_list = [g.get("name") for g in data.get("genres", []) if g.get("name")]
        genres_ar = cls.map_genres_to_arabic(genre_list)

        # Poster & Backdrop
        poster = cls.format_tmdb_image_url(data.get("poster_path"), "w500")
        backdrop = cls.format_tmdb_image_url(data.get("backdrop_path"), "original")

        rating = float(data.get("vote_average", 0.0))
        rating_count = int(data.get("vote_count", 0))

        # External IDs
        ext_ids = {}
        if "id" in data:
            ext_ids["tmdb"] = str(data["id"])
        if "external_ids" in data:
            raw_ext = data["external_ids"]
            for k in ["imdb_id", "tvdb_id", "wikidata_id", "facebook_id", "instagram_id"]:
                if raw_ext.get(k):
                    clean_k = k.replace("_id", "")
                    ext_ids[clean_k] = str(raw_ext[k])

        # People
        people = []
        for creator in data.get("created_by", []):
            people.append({
                "name": creator.get("name"),
                "role": "Creator / Writer",
                "profile_path": cls.format_tmdb_image_url(creator.get("profile_path"), "w185")
            })

        credits = data.get("credits", {})
        for c in credits.get("cast", [])[:15]:
            people.append({
                "name": c.get("name"),
                "role": "Actor",
                "character": c.get("character", ""),
                "profile_path": cls.format_tmdb_image_url(c.get("profile_path"), "w185"),
                "order": c.get("order", 0)
            })

        # Seasons summary
        seasons = []
        for s in data.get("seasons", []):
            seasons.append({
                "season_number": s.get("season_number"),
                "name": s.get("name"),
                "overview": s.get("overview", ""),
                "episode_count": s.get("episode_count", 0),
                "poster_url": cls.format_tmdb_image_url(s.get("poster_path"), "w500"),
                "air_date": s.get("air_date")
            })

        title_loc = {language: title}
        overview_loc = {language: overview} if overview else {}
        tagline_loc = {language: tagline} if tagline else {}

        if original_title and language != "en":
            title_loc["en"] = original_title

        return UnifiedMetadata(
            title=title,
            original_title=original_title,
            title_localized=title_loc,
            overview=overview,
            overview_localized=overview_loc,
            tagline=tagline,
            tagline_localized=tagline_loc,
            year=year,
            release_date=first_air_date,
            duration_minutes=duration,
            item_type="series",
            genres=genre_list,
            genres_ar=genres_ar,
            community_rating=round(rating, 1),
            community_rating_count=rating_count,
            poster_url=poster,
            backdrop_url=backdrop,
            people=people,
            external_ids=ext_ids,
            seasons=seasons,
            raw_payload=data
        )
