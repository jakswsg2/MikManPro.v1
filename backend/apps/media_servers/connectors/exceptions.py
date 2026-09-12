class MediaServerError(Exception):
    """Base exception for media server connector operations."""
    pass

class UserNotFoundError(MediaServerError):
    """Raised when an external user is not found on the media server."""
    pass
