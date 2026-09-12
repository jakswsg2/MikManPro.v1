export type Language = 'ar' | 'en';

export interface Translations {
  appName: string;
  appSubtitle: string;
  home: string;
  movies: string;
  series: string;
  kids: string;
  search: string;
  profile: string;
  settings: string;
  sessions: string;
  login: string;
  logout: string;
  voucherLogin: string;
  hotspotLogin: string;
  guestLogin: string;
  voucherPlaceholder: string;
  username: string;
  password: string;
  submitLogin: string;
  loginSuccess: string;
  loginFailed: string;
  welcomeBack: string;
  continueWatching: string;
  trendingNow: string;
  newReleases: string;
  topRated: string;
  kidsAndFamily: string;
  watchNow: string;
  moreInfo: string;
  download: string;
  downloading: string;
  downloadNotAllowed: string;
  downloadAllowedDesc: string;
  downloadRestrictedDesc: string;
  vipRestricted: string;
  vipRestrictedDesc: string;
  upgradeToVIP: string;
  upgradeNow: string;
  resolution: string;
  duration: string;
  minutes: string;
  year: string;
  rating: string;
  genres: string;
  overview: string;
  audioTracks: string;
  subtitles: string;
  serversAvailable: string;
  seasons: string;
  episodes: string;
  season: string;
  episode: string;
  allGenres: string;
  allResolutions: string;
  allYears: string;
  sortBy: string;
  newest: string;
  highestRated: string;
  mostPopular: string;
  searchPlaceholder: string;
  noResultsFound: string;
  searchSuggestions: string;
  resultsCount: string;
  activeSessions: string;
  currentDevice: string;
  revokeSession: string;
  revokeOtherSessions: string;
  revokeSuccess: string;
  ipAddress: string;
  macAddress: string;
  loginTime: string;
  status: string;
  active: string;
  expired: string;
  language: string;
  arabic: string;
  english: string;
  playbackQuality: string;
  autoplayNext: string;
  gatewayInfo: string;
  mikrotikStatus: string;
  connectedTo: string;
  bandwidth: string;
  unlimited: string;
  profileType: string;
  loungeId: string;
  permissionsList: string;
  permissionGranted: string;
  permissionDenied: string;
  devTools: string;
  close: string;
  playPreview: string;
  playingStream: string;
  serverNode: string;
  bitrate: string;
  plans: string;
  billing: string;
  redeemCard: string;
  invoices: string;
  loadMore: string;
  loadingMore: string;
  showingCount: string;
  of: string;
  allLoaded: string;
  infiniteScroll: string;
  liveTv: string;
  requestsAndSupport: string;
  aiGateway: string;
  observability: string;
  notifications: string;
  epg: string;
  sportsCenter: string;
}

export const translations: Record<Language, Translations> = {
  ar: {
    appName: 'الاستراحة الذكية',
    appSubtitle: 'بوابة البث والمحتوى المحلي عبر شبكة LAN',
    home: 'الرئيسية',
    movies: 'الأفلام',
    series: 'المسلسلات',
    kids: 'ركن الأطفال',
    search: 'البحث الموحد',
    profile: 'حسابي',
    settings: 'الإعدادات',
    sessions: 'الجلسات والأجهزة',
    plans: 'باقات الاشتراك',
    billing: 'الاشتراكات والفوترة',
    redeemCard: 'شحن كرت',
    invoices: 'الفواتير وسجل السندات',
    login: 'تسجيل الدخول',
    logout: 'تسجيل الخروج',
    voucherLogin: 'تسجيل بكود الكرت (Voucher)',
    hotspotLogin: 'تسجيل هوت سبوت ميكروتك',
    guestLogin: 'دخول ضيف سريع',
    voucherPlaceholder: 'أدخل كود الكرت المطبوع (مثال: VIP-98402)',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    submitLogin: 'تسجيل الدخول للشبكة',
    loginSuccess: 'تم تسجيل الدخول بنجاح والتحقق من الصلاحيات',
    loginFailed: 'فشل التحقق من الكود أو اسم المستخدم',
    welcomeBack: 'مرحباً بك في الاستراحة',
    continueWatching: 'متابعة المشاهدة',
    trendingNow: 'الأكثر مشاهدة في الاستراحة',
    newReleases: 'أحدث الإضافات والسينما',
    topRated: 'الأعلى تقييماً',
    kidsAndFamily: 'أفلام ورسوم متحركة عائلية',
    watchNow: 'تشغيل الآن',
    moreInfo: 'تفاصيل ومصادر',
    download: 'تحميل مباشر LAN',
    downloading: 'جاري التحميل بسرعات LAN الفائقة...',
    downloadNotAllowed: 'التحميل غير متاح لباقة حسابك',
    downloadAllowedDesc: 'التحميل عالي السرعة متاح عبر شبكة الاستراحة المحلية بدون استهلاك إنترنت خارجي',
    downloadRestrictedDesc: 'التحميل المباشر يتطلب باقة Premium VIP. يمكنك ترقية حسابك للحصول على الميزة.',
    vipRestricted: 'محتوى حصري VIP',
    vipRestrictedDesc: 'هذا العمل مخصص لأصحاب اشتراكات VIP Premium فائقة الجودة.',
    upgradeToVIP: 'ترقية حسابي إلى VIP',
    upgradeNow: 'ترقية الحساب',
    resolution: 'دقة العرض',
    duration: 'المدة',
    minutes: 'دقيقة',
    year: 'سنة الإنتاج',
    rating: 'التقييم',
    genres: 'التصنيفات',
    overview: 'قصة العمل',
    audioTracks: 'المسارات الصوتية',
    subtitles: 'ملفات الترجمة',
    serversAvailable: 'الخوادم المحلية المتوفر عليها الملف',
    seasons: 'المواسم',
    episodes: 'الحلقات',
    season: 'الموسم',
    episode: 'الحلقة',
    allGenres: 'جميع التصنيفات',
    allResolutions: 'جميع الدقات',
    allYears: 'جميع السنوات',
    sortBy: 'ترتيب حسب',
    newest: 'الأحدث',
    highestRated: 'الأعلى تقييماً',
    mostPopular: 'الأكثر مشاهدة',
    searchPlaceholder: 'ابحث عن فيلم، مسلسل، ممثل، أو تصنيف...',
    noResultsFound: 'لم يتم العثور على نتائج مطابقة للبحث',
    searchSuggestions: 'مقترحات بحث شائعة',
    resultsCount: 'نتيجة مطابقة',
    activeSessions: 'الجلسات والأجهزة النشطة',
    currentDevice: 'هذا الجهاز حالياً',
    revokeSession: 'إنهاء الجلسة',
    revokeOtherSessions: 'تسجيل الخروج من بقية الأجهزة',
    revokeSuccess: 'تم إنهاء الجلسة بنجاح',
    ipAddress: 'عنوان IP',
    macAddress: 'عنوان MAC',
    loginTime: 'وقت الاتصال',
    status: 'الحالة',
    active: 'نشط',
    expired: 'منتهي',
    language: 'اللغة',
    arabic: 'العربية (RTL)',
    english: 'English (LTR)',
    playbackQuality: 'جودة البث الافتراضية',
    autoplayNext: 'تشغيل الحلقة التالية تلقائياً',
    gatewayInfo: 'بيانات بوابة الشبكة المحلية',
    mikrotikStatus: 'حالة اتصال MikroTik Hotspot',
    connectedTo: 'متصل عبر بوابة',
    bandwidth: 'سرعة الشبكة المحلية',
    unlimited: 'فائقة LAN (1 Gbps)',
    profileType: 'نوع الباقة / البروفايل',
    loungeId: 'معرف المستخدم (Lounge ID)',
    permissionsList: 'الصلاحيات المفعلة لحسابك',
    permissionGranted: 'متاح',
    permissionDenied: 'محجوب',
    devTools: 'أدوات الإدارة والمطور',
    close: 'إغلاق',
    playPreview: 'معاينة البث المحلي (Player Preview)',
    playingStream: 'جاري البث المباشر من سيرفر الـ LAN...',
    serverNode: 'خادم الوسائط المصدر',
    bitrate: 'معدل البت',
    loadMore: 'تحميل المزيد',
    loadingMore: 'جاري تحميل المزيد...',
    showingCount: 'عرض',
    of: 'من أصل',
    allLoaded: 'تم عرض جميع الأعمال المتاحة',
    infiniteScroll: 'التمرير التلقائي',
    liveTv: 'البث المباشر والرياضة',
    requestsAndSupport: 'الطلبات والدعم',
    aiGateway: 'بوابة الذكاء الاصطناعي',
    observability: 'المراقبة والنسخ الاحتياطي',
    notifications: 'الإشعارات',
    epg: 'دليل البرامج',
    sportsCenter: 'مركز المباريات'
  },
  en: {
    appName: 'Smart Lounge',
    appSubtitle: 'Unified Local LAN Streaming & Media Portal',
    home: 'Home',
    movies: 'Movies',
    series: 'TV Series',
    kids: 'Kids Zone',
    search: 'Unified Search',
    profile: 'My Profile',
    settings: 'Settings',
    sessions: 'Sessions & Devices',
    plans: 'Subscription Plans',
    billing: 'Billing & Plans',
    redeemCard: 'Redeem Card',
    invoices: 'Invoices & Receipts',
    login: 'Log In',
    logout: 'Log Out',
    voucherLogin: 'Voucher / Card Code Login',
    hotspotLogin: 'MikroTik Hotspot SSO',
    guestLogin: 'Quick Guest Access',
    voucherPlaceholder: 'Enter printed voucher code (e.g., VIP-98402)',
    username: 'Username',
    password: 'Password',
    submitLogin: 'Connect to Lounge Network',
    loginSuccess: 'Successfully authenticated with verified permissions',
    loginFailed: 'Authentication failed. Please check your credentials',
    welcomeBack: 'Welcome to Smart Lounge',
    continueWatching: 'Continue Watching',
    trendingNow: 'Trending in Lounge',
    newReleases: 'New Releases & Cinema',
    topRated: 'Top Rated',
    kidsAndFamily: 'Kids & Family Animation',
    watchNow: 'Watch Now',
    moreInfo: 'Details & Sources',
    download: 'Fast LAN Download',
    downloading: 'Downloading at ultra-fast LAN speeds...',
    downloadNotAllowed: 'Download is not included in your tier',
    downloadAllowedDesc: 'Ultra-fast direct LAN downloads without consuming external internet bandwidth',
    downloadRestrictedDesc: 'Direct LAN download is a VIP Premium feature. Upgrade to enable instant offline saves.',
    vipRestricted: 'Exclusive VIP Content',
    vipRestrictedDesc: 'This title is exclusively available for VIP Premium tier subscribers.',
    upgradeToVIP: 'Upgrade to VIP',
    upgradeNow: 'Upgrade Account',
    resolution: 'Resolution',
    duration: 'Duration',
    minutes: 'mins',
    year: 'Year',
    rating: 'Rating',
    genres: 'Genres',
    overview: 'Synopsis',
    audioTracks: 'Audio Tracks',
    subtitles: 'Subtitles',
    serversAvailable: 'Available LAN Media Servers',
    seasons: 'Seasons',
    episodes: 'Episodes',
    season: 'Season',
    episode: 'Episode',
    allGenres: 'All Genres',
    allResolutions: 'All Resolutions',
    allYears: 'All Years',
    sortBy: 'Sort By',
    newest: 'Newest',
    highestRated: 'Highest Rated',
    mostPopular: 'Most Popular',
    searchPlaceholder: 'Search for movies, series, actors, or genres...',
    noResultsFound: 'No results found matching your query',
    searchSuggestions: 'Popular Search Tags',
    resultsCount: 'matching results',
    activeSessions: 'Active Sessions & Devices',
    currentDevice: 'This Device',
    revokeSession: 'Revoke Session',
    revokeOtherSessions: 'Log Out from Other Devices',
    revokeSuccess: 'Session successfully revoked',
    ipAddress: 'IP Address',
    macAddress: 'MAC Address',
    loginTime: 'Connected Since',
    status: 'Status',
    active: 'Active',
    expired: 'Expired',
    language: 'Language',
    arabic: 'العربية (RTL)',
    english: 'English (LTR)',
    playbackQuality: 'Default Playback Quality',
    autoplayNext: 'Autoplay Next Episode',
    gatewayInfo: 'LAN Gateway Information',
    mikrotikStatus: 'MikroTik Hotspot Status',
    connectedTo: 'Connected via Gateway',
    bandwidth: 'Local LAN Bandwidth',
    unlimited: 'Ultra-Fast LAN (1 Gbps)',
    profileType: 'Account Plan / Profile',
    loungeId: 'Lounge ID',
    permissionsList: 'Active Entitlements & Permissions',
    permissionGranted: 'Enabled',
    permissionDenied: 'Restricted',
    devTools: 'Admin & Dev Controls',
    close: 'Close',
    playPreview: 'LAN Stream Preview (Player Stub)',
    playingStream: 'Streaming directly from local LAN media server...',
    serverNode: 'Source Media Server',
    bitrate: 'Bitrate',
    loadMore: 'Load More',
    loadingMore: 'Loading more items...',
    showingCount: 'Showing',
    of: 'of',
    allLoaded: 'All available items loaded',
    infiniteScroll: 'Infinite Scroll',
    liveTv: 'Live TV & Sports',
    requestsAndSupport: 'Requests & Support',
    aiGateway: 'AI Gateway & Autonomy',
    observability: 'Observability & Tracing',
    notifications: 'Notifications',
    epg: 'EPG Guide',
    sportsCenter: 'Sports Center'
  }
};
