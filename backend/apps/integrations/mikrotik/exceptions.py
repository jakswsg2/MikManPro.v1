class MikroTikException(Exception):
    """Base exception for all MikroTik integration errors"""
    pass

class RouterConnectionError(MikroTikException):
    """Raised when failing to establish TCP/API connection with MikroTik RouterOS"""
    pass

class RouterAuthenticationError(MikroTikException):
    """Raised when RouterOS rejects API login credentials"""
    pass

class RouterTimeoutError(MikroTikException):
    """Raised when a RouterOS command or query times out"""
    pass

class RouterCommandError(MikroTikException):
    """Raised when RouterOS returns a trap or command failure"""
    pass
