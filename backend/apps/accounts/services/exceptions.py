"""
استثناءات مسار التهيئة والإعداد الأولي (Onboarding Exceptions).
"""

class OnboardingException(Exception):
    """الاستثناء الأساسي لعمليات ومسار التهيئة والإعداد الأولي"""
    pass


class StepNotFound(OnboardingException):
    """الخطوة المطلوبة غير موجودة في قوالب مسار الإعداد"""
    pass


class StepNotSkippable(OnboardingException):
    """لا يمكن تخطي هذه الخطوة لأنها إلزامية أو غير قابلة للتخطي"""
    pass


class StepDependencyMissing(OnboardingException):
    """الخطوة تعتمد على خطوات سابقة لم يتم إكمالها بعد"""
    pass


class OnboardingIncomplete(OnboardingException):
    """لا يمكن إنهاء مسار التهيئة لوجود خطوات إلزامية ناقصة"""
    pass


class TermsNotAccepted(OnboardingException):
    """يجب الموافقة الإلزامية على شروط الخدمة والاتفاقية للمتابعة"""
    pass


class PrivacyNotAccepted(OnboardingException):
    """يجب الموافقة الإلزامية على سياسة الخصوصية للمتابعة"""
    pass
