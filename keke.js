// 可可影视 · drpy2 草稿（由 Forward 组件 zen.keke.rex.stream 移植，2026-10-21）
// 接口链：vcache /v5/config/appInit.capi（动态域名）→ vlogic POST /user/anonymous（匿名会话，token 在响应头）
//   → /vod/search/query（搜索，游标翻页）→ /v2/vod/detail.capi（线路）→ /v2/vod/episodes.capi（选集）→ /vod/episodePlayUrl（直链 m3u8）
// 每个请求带 HmacSHA1 签名；响应体为 AES-CBC 二进制密文，靠 req 的 toBase64 取回后解密（本源最大移植风险点：老客户端若不支持 toBase64 会解码失败）。
// 只取免登录免加速线路（needLogin=0 且 needAccelerate=0）。无分类/列表接口（原组件即搜索型），仅搜索 + 详情 + 播放。
// 实测（2026-10-21）：appInit/匿名登录/搜索/详情/选集/取播放地址全链路通过；最终 CDN 对机房 IP 返回 403，需家宽环境复验播放。
var rule = {
    title: '可可影视',
    host: 'https://kekys.com',
    url: '',
    searchUrl: '/kksearch?wd=**&pg=fypage',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: {
        'User-Agent': 'okhttp/4.12.0'
    },
    timeout: 20000,
    class_name: '',
    class_url: '',
    play_parse: true,
    lazy: `js:
let parts = String(input).split('|');
if (parts.length === 3) {
  let plays = kkApi('logic', '/vod/episodePlayUrl', { vodId: parts[0], siteId: parts[1], episodeId: parts[2] });
  let list = (plays || []).slice().sort(function (a, b) {
    return (/h26?5|hevc/i.test(a.type || '') ? 1 : 0) - (/h26?5|hevc/i.test(b.type || '') ? 1 : 0);
  });
  if (list.length) {
    input = {
      parse: 0,
      jx: 0,
      url: String(list[0].url),
      header: { 'User-Agent': 'okhttp/4.12.0' }
    };
  }
}`,
    预处理: `js:
// ==== 可可影视 App API 移植（源自 Forward 组件 zen.keke.rex.stream）====
// 常量由组件内置 App 参数原样移植（hex 形式），签名走自带纯 JS SHA1/HMAC（已对标准向量验证）。
var KK_C = {"domain_key":"6630633962623732396339333961333530623565353630343966643536326663","domain_iv":"64393662323132333338656337373563","api_key":"617974357779356166776d7772706231396b3973337073783364796d7964306e","api_iv":"623374303639696a793770697277306a","sign_key":"6b736767737234747036646966646f316333696d386671643367"};
var KK_HOSTS = {
  cache: ['https://vcache.ybsdkl.cn', 'https://vcache.shkjbd.com', 'https://vcache.srnffc.cn', 'https://vcache.mjrlin.cn'],
  logic: ['https://vlogic.ybsdkl.cn', 'https://vlogic.shkjbd.com', 'https://vlogic.srnffc.cn', 'https://vlogic.mjrlin.cn']
};
var KK_PRIORITY = ['hongniu', 'haohua', 'xinlang', 'subo', 'dbzy', 'ikun', 'guangsu', 'feifan', 'baofeng', 'liangzi', '1080zy', 'suoni', 'dyttzy', 'wujin'];
var KK_DEVICE = null;
var KK_SESSION = null;
var KK_BOOTED = false;
var KK_CURSOR = {};
var KK_LAST = {};

function kkText(value) {
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}
function kkUnique(values) {
  var result = [];
  (values || []).forEach(function (url) {
    url = kkText(url).replace(/\\/+$/, '');
    if (/^https:\\/\\/[a-zA-Z0-9.-]+(?::\\d+)?$/.test(url) && result.indexOf(url) < 0) result.push(url);
  });
  return result;
}

// Pure-JS SHA-1 (byte array based) + HMAC-SHA1 with hex key. No CryptoJS dependency.
function kkSha1Bytes(bytes) {
  function rl(v, a) { return (v << a) | (v >>> (32 - a)); }
  var words = [];
  for (var i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8));
  words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | (0x80 << (24 - (bytes.length % 4) * 8));
  words[((bytes.length + 8) >> 6 << 4) + 15] = bytes.length * 8;
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  var w = new Array(80), t, f, k, tmp;
  for (var b = 0; b < words.length; b += 16) {
    var a = h0, bb = h1, c = h2, d = h3, e = h4;
    for (t = 0; t < 80; t++) {
      if (t < 16) w[t] = words[b + t] | 0;
      else w[t] = rl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
      if (t < 20) { f = (bb & c) | (~bb & d); k = 0x5A827999; }
      else if (t < 40) { f = bb ^ c ^ d; k = 0x6ED9EBA1; }
      else if (t < 60) { f = (bb & c) | (bb & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = bb ^ c ^ d; k = 0xCA62C1D6; }
      tmp = (rl(a, 5) + f + e + k + w[t]) | 0;
      e = d; d = c; c = rl(bb, 30); bb = a; a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  var out = [];
  [h0, h1, h2, h3, h4].forEach(function (h) {
    for (var i = 3; i >= 0; i--) out.push((h >>> (i * 8)) & 255);
  });
  return out;
}
function kkUtf8Bytes(str) {
  var esc = unescape(encodeURIComponent(String(str)));
  var out = [];
  for (var i = 0; i < esc.length; i++) out.push(esc.charCodeAt(i) & 255);
  return out;
}
function kkBytesHex(bytes) {
  return bytes.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function kkHmacSha1Hex(message, keyHex) {
  var key = [];
  for (var i = 0; i < keyHex.length; i += 2) key.push(parseInt(keyHex.substr(i, 2), 16));
  if (key.length > 64) key = kkSha1Bytes(key);
  while (key.length < 64) key.push(0);
  var inner = [], outer = [], j;
  for (j = 0; j < 64; j++) { inner.push(key[j] ^ 0x36); outer.push(key[j] ^ 0x5c); }
  var innerHash = kkSha1Bytes(inner.concat(kkUtf8Bytes(message)));
  return kkBytesHex(kkSha1Bytes(outer.concat(innerHash)));
}

function kkHeaders(method, path, params, kind, session) {
  var headers = {
    'User-Agent': 'com.kkdyD938260715.t201143/3.5.0 Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)',
    appId: 'kkdy', os: 'android', appVersion: '3.5.0', package: 'com.kkdyD938260715.t201143',
    apiVer: 'v2', channelId: 'c900', st: '2', 'x-d-video': '0', 'X-CDN': kind === 'cache' ? '1' : '0',
    deviceId: KK_DEVICE.deviceId, deviceCreatedAt: KK_DEVICE.deviceCreatedAt,
    userId: session && session.userId ? String(session.userId) : '0',
    deviceInfo: JSON.stringify({ brand: 'Google', model: 'Pixel 7', osVersion: '13', osLevel: '33', platform: 'android', appVersion: '3.5.0' })
  };
  if (session && session.token) headers['X-Token'] = session.token;
  var ts = String(Date.now());
  var query = Object.keys(params).map(function (key) { return key + '=' + params[key]; }).sort().join('&');
  var chosen = ['appId', 'deviceCreatedAt', 'deviceId', 'st', 'userId'].map(function (key) { return key + '=' + headers[key]; }).join('&');
  var canonical = [method.toLowerCase(), path, query, ts, chosen, ''].join('|');
  headers.ts = ts;
  headers.sign = kkHmacSha1Hex(canonical, KK_C.sign_key);
  return headers;
}

// 响应体是二进制 AES 密文，必须以 base64 形式取回（依赖 drpy req 的 toBase64 选项）。
function kkDecode(body) {
  var t = String(body == null ? '' : body).trim();
  if (!t) throw new Error('可可接口返回空数据');
  if (/^[\\[{]/.test(t)) return JSON.parse(t);
  try {
    var plain = CryptoJS.AES.decrypt({ ciphertext: CryptoJS.enc.Base64.parse(t) }, CryptoJS.enc.Hex.parse(KK_C.api_key), {
      iv: CryptoJS.enc.Hex.parse(KK_C.api_iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);
    if (plain) return JSON.parse(plain);
  } catch (e) {}
  return JSON.parse(CryptoJS.enc.Base64.parse(t).toString(CryptoJS.enc.Utf8));
}

function kkFetchRaw(kind, path, params, method, session) {
  var hosts = kkUnique(KK_HOSTS[kind]);
  var lastErr = null;
  for (var i = 0; i < Math.min(hosts.length, 2); i++) {
    try {
      var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
      var url = hosts[i] + path + (qs ? '?' + qs : '');
      var opt = { headers: kkHeaders(method, path, params, kind, session), method: method, timeout: 20000, withHeaders: true, toBase64: true };
      if (method === 'POST') opt.body = '';
      var res = fetch(url, opt);
      var body = res, hdrs = {};
      if (typeof res === 'string') {
        try {
          var j = JSON.parse(res);
          if (j && typeof j === 'object' && ('body' in j)) { body = j.body; hdrs = j.headers || {}; }
        } catch (e) {}
      } else if (res && typeof res === 'object') { body = res.body; hdrs = res.headers || {}; }
      var data = kkDecode(body);
      var token = '';
      Object.keys(hdrs || {}).forEach(function (k) { if (k.toLowerCase() === 'x-token') token = String(hdrs[k]); });
      if (i > 0) KK_HOSTS[kind] = [hosts[i]].concat(hosts.filter(function (v) { return v !== hosts[i]; }));
      return { data: data, token: token };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('可可接口连接失败');
}

function kkRaw(kind, path, input, method, session) {
  var params = {};
  Object.keys(input || {}).forEach(function (key) { if (input[key] != null) params[key] = String(input[key]); });
  method = method || 'GET';
  if (method === 'GET') {
    params.os = 'android'; params.appId = 'kkdy';
    params.userLevel = String(session && session.level || 0);
  }
  return kkFetchRaw(kind, path, params, method, session);
}

function kkLogin() {
  var r = kkRaw('logic', '/user/anonymous', {}, 'POST', null);
  var body = r.data || {};
  var data = body.data || {};
  var token = r.token || data.token;
  if (Number(body.code) !== 200 || !data.id || !token) throw new Error('可可匿名登录失败');
  KK_SESSION = { token: token, userId: String(data.id), level: Number(data.level) || 0 };
  return KK_SESSION;
}

function kkEnsure() {
  if (!KK_DEVICE) {
    var id = '';
    for (var i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16);
    KK_DEVICE = { deviceId: id, deviceCreatedAt: String(Date.now()) };
  }
  if (!KK_BOOTED) {
    KK_BOOTED = true;
    try {
      var r = kkRaw('cache', '/v5/config/appInit.capi', {}, 'GET', null);
      var urls = r.data && r.data.urls;
      if (urls) ['cache', 'logic'].forEach(function (k) {
        if (urls[k] && urls[k].length) KK_HOSTS[k] = kkUnique(urls[k].concat(KK_HOSTS[k]));
      });
    } catch (e) {}
  }
  if (!KK_SESSION) kkLogin();
}

function kkApi(kind, path, params) {
  kkEnsure();
  var r = kkRaw(kind, path, params, 'GET', KK_SESSION);
  var data = r.data || {};
  if (Number(data.code) === 40401 || Number(data.code) === 40100) {
    kkLogin();
    r = kkRaw(kind, path, params, 'GET', KK_SESSION);
    data = r.data || {};
  }
  if (Number(data.code) !== 200) throw new Error('可可接口：' + (data.message || data.code));
  return data.data;
}`,
    推荐: '',
    一级: '',
    二级: `js:
let detail = kkApi('cache', '/v2/vod/detail.capi', { vodId: input });
let rank = function (s) {
  let r = KK_PRIORITY.indexOf(s.siteId);
  return r < 0 ? 100 : r;
};
let seen = {};
let sources = (detail.playSources || []).filter(function (s) {
  return !Number(s.needLogin) && !Number(s.needAccelerate) && Number(s.total) > 0;
}).sort(function (a, b) { return rank(a) - rank(b); }).filter(function (s) {
  if (seen[s.siteId]) return false;
  seen[s.siteId] = true;
  return true;
}).slice(0, 8);
let froms = [];
let urls = [];
sources.forEach(function (s) {
  let eps = [];
  try {
    eps = kkApi('cache', '/v2/vod/episodes.capi', {
      vodId: detail.id, siteId: s.siteId,
      episodeVodId: s.episodeVodId == null ? detail.id : s.episodeVodId
    });
  } catch (e) {}
  if (!eps || !eps.length) return;
  froms.push(kkText(s.name || s.siteId));
  urls.push(eps.map(function (ep) {
    return kkText(ep.title || ('第' + ep.index + '集')) + '$' + detail.id + '|' + s.siteId + '|' + ep.id;
  }).join('#'));
});
VOD = {
  vod_id: String(detail.id),
  vod_name: kkText(detail.title),
  vod_pic: detail.poster || detail.pic || '',
  vod_year: detail.year && (detail.year.name || detail.year.id || detail.year) || '',
  vod_content: kkText(detail.intro || detail.description || ''),
  vod_play_from: froms.join('$$$'),
  vod_play_url: urls.join('$$$')
};`,
    搜索: `js:
let d = [];
let wd = '';
let pg = 1;
let m1 = input.match(/[?&]wd=([^&]*)/);
if (m1) wd = decodeURIComponent(m1[1]);
let m2 = input.match(/[?&]pg=(\\d+)/);
if (m2) pg = parseInt(m2[1]);
if (pg > 1 && KK_CURSOR[wd]) {
  let more = kkApi('logic', '/vod/search/query', { channelId: '0', k: wd, next: KK_CURSOR[wd] });
  KK_CURSOR[wd] = more && more.next ? String(more.next) : '';
  KK_LAST[wd] = (more && more.items) || [];
} else {
  let found = kkApi('logic', '/vod/search/query', { channelId: '0', k: wd, next: '' });
  KK_CURSOR[wd] = found && found.next ? String(found.next) : '';
  KK_LAST[wd] = (found && found.items) || [];
}
(KK_LAST[wd] || []).forEach(function (it) {
  d.push({
    vod_name: kkText(it.title),
    vod_id: String(it.id),
    vod_pic: it.poster || it.pic || '',
    vod_remarks: ''
  });
});
setResult(d);`
};
