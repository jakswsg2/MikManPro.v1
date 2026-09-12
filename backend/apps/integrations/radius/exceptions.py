class RadiusException(Exception):
    """Base RADIUS integration exception"""
    pass

class RadiusAuthenticationFailed(RadiusException):
    """Raised when RADIUS server returns Access-Reject"""
    pass

class RadiusServerUnreachable(RadiusException):
    """Raised when all configured RADIUS servers (Primary, Secondary, Failover) fail to respond"""
    pass

class RadiusTimeoutError(RadiusException):
    """Raised on RADIUS socket timeout"""
    pass
