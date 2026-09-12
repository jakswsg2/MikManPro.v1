import { LiveChannel, SportsMatch } from '../types';

export const INITIAL_LIVE_CHANNELS: LiveChannel[] = [
  {
    id: 'ch-bein-1',
    number: 1,
    name: 'beIN SPORTS 1 HD Premium',
    category: 'SPORTS',
    logo_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch1/stream.m3u8',
    resolution: '1080p 60fps',
    bitrate_mbps: 8.5,
    is_premium: true,
    server_source: 'LAN Tuner Gateway Alpha (DVB-S2 IP Gateway)',
    current_program: {
      id: 'epg-b1-1',
      channel_id: 'ch-bein-1',
      title: 'استوديو دوري أبطال أوروبا المباشر',
      description: 'تحليل فني لمباريات الليلة مع كوكبة من نجوم التحليل الرياضي العربي والعالمي',
      start_time: new Date(Date.now() - 35 * 60000).toISOString(),
      end_time: new Date(Date.now() + 55 * 60000).toISOString(),
      genre: 'رياضة وتغطية حية',
      is_live: true,
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80'
    },
    upcoming_programs: [
      {
        id: 'epg-b1-2',
        channel_id: 'ch-bein-1',
        title: 'مباراة ريال مدريد ضد مانشستر سيتي',
        description: 'بث حي ومباشر من ملعب سانتياغو برنابيو بتعليق عصام الشوالي',
        start_time: new Date(Date.now() + 55 * 60000).toISOString(),
        end_time: new Date(Date.now() + 180 * 60000).toISOString(),
        genre: 'كرة قدم مباشرة',
        is_live: true
      }
    ]
  },
  {
    id: 'ch-ssc-1',
    number: 2,
    name: 'SSC 1 HD الرياضية',
    category: 'SPORTS',
    logo_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch2/stream.m3u8',
    resolution: '4K HDR',
    bitrate_mbps: 18.2,
    is_premium: true,
    server_source: 'LAN Multicast IPTV Edge B',
    current_program: {
      id: 'epg-ssc-1',
      channel_id: 'ch-ssc-1',
      title: 'كلاسيكو دوري روشن السعودي',
      description: 'الهلال ضد النصر في قمة كروية ساخنة مباشرة من الرياض',
      start_time: new Date(Date.now() - 50 * 60000).toISOString(),
      end_time: new Date(Date.now() + 45 * 60000).toISOString(),
      genre: 'كرة قدم',
      is_live: true,
      thumbnail: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=400&q=80'
    }
  },
  {
    id: 'ch-osn-movies',
    number: 3,
    name: 'OSN Movies Premiere HD',
    category: 'MOVIES',
    logo_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch3/stream.m3u8',
    resolution: '1080p FHD',
    bitrate_mbps: 6.2,
    is_premium: true,
    server_source: 'Jellyfin LAN Live Node',
    current_program: {
      id: 'epg-osn-1',
      channel_id: 'ch-osn-movies',
      title: 'Dune: Part Two (2024)',
      description: 'بول أتريدس يتحد مع تشاني والفريمن سعياً للانتقام ضد المتآمرين الذين دمروا عائلته',
      start_time: new Date(Date.now() - 20 * 60000).toISOString(),
      end_time: new Date(Date.now() + 140 * 60000).toISOString(),
      genre: 'خيال علمي ومغامرة',
      is_live: false,
      thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=80'
    }
  },
  {
    id: 'ch-natgeo',
    number: 4,
    name: 'National Geographic Abu Dhabi',
    category: 'DOCUMENTARY',
    logo_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch4/stream.m3u8',
    resolution: '1080p FHD',
    bitrate_mbps: 5.0,
    is_premium: false,
    server_source: 'LAN Multicast IPTV Edge A',
    current_program: {
      id: 'epg-ng-1',
      channel_id: 'ch-natgeo',
      title: 'سمك القرش المفترس: أعماق المحيط',
      description: 'رحلة استكشافية وثائقية في أعماق المحيط الهادئ لدراسة سلوك الحيوانات البحرية العملاقة',
      start_time: new Date(Date.now() - 10 * 60000).toISOString(),
      end_time: new Date(Date.now() + 50 * 60000).toISOString(),
      genre: 'وثائقي واستكشاف',
      is_live: false,
      thumbnail: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80'
    }
  },
  {
    id: 'ch-aljazeera',
    number: 5,
    name: 'Al Jazeera News HD الأخبارية',
    category: 'NEWS',
    logo_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch5/stream.m3u8',
    resolution: '1080p FHD',
    bitrate_mbps: 4.5,
    is_premium: false,
    server_source: 'LAN Free Stream Gateway',
    current_program: {
      id: 'epg-aj-1',
      channel_id: 'ch-aljazeera',
      title: 'نشرة الأخبار وحصاد اليوم',
      description: 'تغطية إخبارية حية ومباشرة للأحداث الإقليمية والعالمية وتقارير المراسلين الميدانيين',
      start_time: new Date(Date.now() - 15 * 60000).toISOString(),
      end_time: new Date(Date.now() + 45 * 60000).toISOString(),
      genre: 'أخبار وتحليلات',
      is_live: true
    }
  },
  {
    id: 'ch-mbc-1',
    number: 6,
    name: 'MBC 1 HD المنوعة',
    category: 'ENTERTAINMENT',
    logo_url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=200&q=80',
    stream_url: 'http://192.168.88.240:8096/LiveStreams/ch6/stream.m3u8',
    resolution: '1080p FHD',
    bitrate_mbps: 5.5,
    is_premium: false,
    server_source: 'LAN Multicast IPTV Edge A',
    current_program: {
      id: 'epg-mbc-1',
      channel_id: 'ch-mbc-1',
      title: 'برنامج صدى الملاعب',
      description: 'متابعة حية لأبرز كواليس كرة القدم العربية واللقاءات الحصرية مع نجوم الرياضة',
      start_time: new Date(Date.now() - 40 * 60000).toISOString(),
      end_time: new Date(Date.now() + 30 * 60000).toISOString(),
      genre: 'ترفيه ومنوعات',
      is_live: true
    }
  }
];

export const INITIAL_SPORTS_MATCHES: SportsMatch[] = [
  {
    id: 'match-1',
    tournament: 'دوري أبطال أوروبا • UEFA Champions League',
    round: 'ذهاب نصف النهائي',
    home_team: {
      name: 'ريال مدريد (Real Madrid)',
      logo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=120&q=80',
      score: 2
    },
    away_team: {
      name: 'مانشستر سيتي (Man City)',
      logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=120&q=80',
      score: 2
    },
    start_time: new Date(Date.now() - 67 * 60000).toISOString(),
    status: 'LIVE',
    current_minute: '67\'',
    stadium: 'ملعب سانتياغو برنابيو (مدريد)',
    commentator: 'عصام الشوالي',
    channel_id: 'ch-bein-1',
    channel_name: 'beIN SPORTS 1 HD Premium',
    is_featured: true
  },
  {
    id: 'match-2',
    tournament: 'دوري روشن السعودي للمحترفين',
    round: 'الجولة 29',
    home_team: {
      name: 'الهلال (Al Hilal)',
      logo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=120&q=80',
      score: 3
    },
    away_team: {
      name: 'النصر (Al Nassr)',
      logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=120&q=80',
      score: 1
    },
    start_time: new Date(Date.now() - 82 * 60000).toISOString(),
    status: 'LIVE',
    current_minute: '82\'',
    stadium: 'المملكة أرينا (الرياض)',
    commentator: 'فهد العتيبي',
    channel_id: 'ch-ssc-1',
    channel_name: 'SSC 1 HD الرياضية',
    is_featured: true
  },
  {
    id: 'match-3',
    tournament: 'الدوري الإنجليزي الممتاز • Premier League',
    round: 'الجولة 34',
    home_team: {
      name: 'ليفربول (Liverpool)',
      logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=120&q=80'
    },
    away_team: {
      name: 'أرسنال (Arsenal)',
      logo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=120&q=80'
    },
    start_time: new Date(Date.now() + 150 * 60000).toISOString(),
    status: 'SCHEDULED',
    stadium: 'ملعب أنفيلد (ليفربول)',
    commentator: 'حفيظ دراجي',
    channel_id: 'ch-bein-1',
    channel_name: 'beIN SPORTS 1 HD Premium',
    is_featured: false
  },
  {
    id: 'match-4',
    tournament: 'الدوري الإسباني • LaLiga',
    round: 'الجولة 33',
    home_team: {
      name: 'برشلونة (Barcelona)',
      logo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=120&q=80',
      score: 4
    },
    away_team: {
      name: 'أتلتيكو مدريد (Atletico)',
      logo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=120&q=80',
      score: 2
    },
    start_time: new Date(Date.now() - 180 * 60000).toISOString(),
    status: 'FINISHED',
    stadium: 'ملعب لويس كومبانيس (برشلونة)',
    commentator: 'خليل البلوشي',
    channel_id: 'ch-bein-1',
    channel_name: 'beIN SPORTS 1 HD Premium',
    is_featured: false
  }
];
