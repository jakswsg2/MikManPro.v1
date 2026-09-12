import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from apps.accounts.models import User
from .services import MediaAccountLifecycleService

logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def user_lifecycle_media_account_handler(sender, instance, created, **kwargs):
    """
    Hooks into User post_save to trigger account provisioning upon creation,
    or suspension/reactivation upon status updates.
    """
    lifecycle = MediaAccountLifecycleService()

    if created:
        if instance.status == User.Status.ACTIVE:
            try:
                lifecycle.on_user_created(instance)
            except Exception as e:
                logger.error(f"Error in on_user_created signal handler: {e}")
    else:
        # Check status transitions
        if instance.status in [User.Status.EXPIRED, User.Status.SUSPENDED]:
            try:
                lifecycle.on_subscription_expired(instance)
            except Exception as e:
                logger.error(f"Error in on_subscription_expired signal handler: {e}")
        elif instance.status == User.Status.ACTIVE:
            try:
                lifecycle.on_subscription_activated(instance)
            except Exception as e:
                logger.error(f"Error in on_subscription_activated signal handler: {e}")

@receiver(post_delete, sender=User)
def user_delete_media_account_handler(sender, instance, **kwargs):
    """
    Ensures media accounts are cleaned up or flagged when a user is deleted.
    """
    try:
        lifecycle = MediaAccountLifecycleService()
        lifecycle.on_user_deleted(instance)
    except Exception as e:
        logger.error(f"Error in on_user_deleted signal handler: {e}")
