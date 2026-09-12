import { ContentRequest, SupportTicket, AppNotification } from '../types';

export const INITIAL_CONTENT_REQUESTS: ContentRequest[] = [
  {
    id: 'req-1',
    user_id: 'usr-1',
    user_name: 'سلطان الشمري',
    user_lounge_id: 'LU-000152',
    title: 'Gladiator II (2024)',
    media_type: 'movie',
    release_year: 2024,
    poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
    notes: 'نرجو توفير النسخة بأعلى دقة 4K HDR مع صوت Dolby Atmos وترجمة احترافية',
    status: 'DOWNLOADING',
    progress_percent: 78,
    votes: 14,
    voted_by_users: ['usr-1', 'usr-3', 'usr-4'],
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    admin_reply: 'تمت الموافقة وجاري السحب إلى كاش خادم Jellyfin Alpha بسرعة 120 MB/s.'
  },
  {
    id: 'req-2',
    user_id: 'usr-4',
    user_name: 'أحمد الصالح',
    user_lounge_id: 'LU-000412',
    title: 'The Penguin (Season 1)',
    media_type: 'series',
    release_year: 2024,
    poster_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&q=80',
    notes: 'مسلسل البطريق من عالم باتمان، نتمنى توفير كافة الحلقات بمجرد صدورها',
    status: 'APPROVED',
    votes: 21,
    voted_by_users: ['usr-1', 'usr-4'],
    created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    admin_reply: 'تمت الجدولة في نظام السحب التلقائي.'
  },
  {
    id: 'req-3',
    user_id: 'usr-2',
    user_name: 'كرم وعائلته',
    user_lounge_id: 'LU-000289',
    title: 'Inside Out 2 (2024)',
    media_type: 'movie',
    release_year: 2024,
    poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
    notes: 'أرجو إضافة الدبلجة العربية المصرية والخليجية لفيلم قلباً وقالباً 2',
    status: 'AVAILABLE',
    progress_percent: 100,
    votes: 35,
    voted_by_users: ['usr-1', 'usr-2', 'usr-3', 'usr-4'],
    created_at: new Date(Date.now() - 120 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    admin_reply: 'تمت إتاحة الفيلم في قسم الأطفال والعائلة بكامل مسارات الدبلجة!'
  },
  {
    id: 'req-4',
    user_id: 'usr-1',
    user_name: 'سلطان الشمري',
    user_lounge_id: 'LU-000152',
    title: 'Severance (Season 2)',
    media_type: 'series',
    release_year: 2025,
    notes: 'الموسم الثاني المنتظر من دراما الخيال والغموض على Apple TV+',
    status: 'PENDING',
    votes: 9,
    voted_by_users: ['usr-1'],
    created_at: new Date(Date.now() - 10 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 3600000).toISOString()
  }
];

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'tkt-1',
    ticket_number: 'TK-8942',
    user_id: 'usr-1',
    user_name: 'سلطان الشمري',
    category: 'NETWORK_WIFI',
    title: 'طلب تفعيل ميزة البث الخارجي عبر VLC في قسم الـ VIP',
    description: 'قمت بتشغيل فيلم 4K عبر شاشة الصالة عبر VLC ولكن يطلب توثيق الرابط المشفر، كيف يمكنني تفعيل ذلك؟',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    messages: [
      {
        id: 'msg-1',
        ticket_id: 'tkt-1',
        sender_type: 'USER',
        sender_name: 'سلطان الشمري',
        message: 'أهلاً بكم، أحاول استخدام بروتوكول البث الخارجي VLC Player على شاشة الغرفة الذكية، هل التوكن مشفر؟',
        created_at: new Date(Date.now() - 14 * 3600000).toISOString()
      },
      {
        id: 'msg-2',
        ticket_id: 'tkt-1',
        sender_type: 'AGENT',
        sender_name: 'م. طارق الناصر (مدير الشبكة)',
        message: 'مرحباً بك عزيزي سلطان، تم توليد توكن HMAC مؤقت بصلاحية 4 ساعات، يمكنك نسخه مباشرة عبر زر "تشغيل عبر VLC" دون الحاجة لكلمة مرور.',
        created_at: new Date(Date.now() - 10 * 3600000).toISOString()
      }
    ]
  },
  {
    id: 'tkt-2',
    ticket_number: 'TK-8931',
    user_id: 'usr-4',
    user_name: 'أحمد الصالح',
    category: 'PLAYBACK_BUFFERING',
    title: 'استفسار عن تمديد رصيد كرت الهوتسبوت',
    description: 'تبقت ساعتان على انتهاء كرت الإنترنت في استراحة كرم، هل يمكن ترقيته إلى باقة VIP دون إعادة تسجيل الدخول؟',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    messages: [
      {
        id: 'msg-3',
        ticket_id: 'tkt-2',
        sender_type: 'USER',
        sender_name: 'أحمد الصالح',
        message: 'السلام عليكم، لدي كرت هوتسبوت ينتهي اليوم وأرغب في الشحن مباشرة عبر صفحة الاشتراكات.',
        created_at: new Date(Date.now() - 48 * 3600000).toISOString()
      },
      {
        id: 'msg-4',
        ticket_id: 'tkt-2',
        sender_type: 'AGENT',
        sender_name: 'فريق الدعم الفني',
        message: 'وعليكم السلام، نعم يمكنك إدخال كود الكرت الجديد في خانة "شحن كرت" وسيتم ترحيل الوقت والرصيد تلقائياً لسيرفر MikroTik.',
        created_at: new Date(Date.now() - 24 * 3600000).toISOString()
      }
    ]
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'تمت إضافة حلقة جديدة!',
    message: 'الحلقة السابعة من الموسم الرابع لمسلسل Succession أصبحت متاحة الآن على خادم LAN بجودة 4K.',
    type: 'NEW_EPISODE',
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    is_read: false,
    action_label: 'شاهد الآن',
    action_target: 'series'
  },
  {
    id: 'notif-2',
    title: 'تنبيه انتهاء صلاحية كرت الـ Hotspot',
    message: 'سينتهي اشتراك كرت الإنترنت الحالي خلال 6 ساعات. سارع بتجديد باقتك لتفادي انقطاع الجلسة.',
    type: 'CARD_EXPIRING',
    created_at: new Date(Date.now() - 110 * 60000).toISOString(),
    is_read: false,
    action_label: 'تجديد الكرت',
    action_target: 'billing'
  },
  {
    id: 'notif-3',
    title: 'طلب الوسائط متاح الآن',
    message: 'تم الانتهاء من تحميل وتجهيز فيلم Inside Out 2 استجابة لطلبك وهو جاهز للمشاهدة العائلية.',
    type: 'REQUEST_APPROVED',
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    is_read: true,
    action_label: 'انتقل للفيلم',
    action_target: 'kids'
  },
  {
    id: 'notif-4',
    title: 'ترقية خادم الوسائط Jellyfin LAN',
    message: 'تمت ترقية كوديك فك التشفير إلى AV1 و NVENC لتقليل استهلاك البطارية بنسبة 40% أثناء البث.',
    type: 'MAINTENANCE',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    is_read: true
  }
];
